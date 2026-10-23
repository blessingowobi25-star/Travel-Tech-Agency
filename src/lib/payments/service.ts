import { newId, nowIso } from '@/db/ids';
import { many, one, run } from '@/db/client';
import { logger } from '@/lib/logger';
import { getOrderById, setOrderPayable, setOrderStatus } from '@/repositories/orders';
import type { Order } from '@/types/domain';
import {
  initialisePayment,
  paystackConfigured,
  verifyPayment,
} from './paystack';

/**
 * Payment orchestration.
 *
 * The order -> payment -> paid lifecycle lives here so the API routes stay
 * thin. Every state change is written to `payment_attempts` and
 * `payment_events` so the trail is auditable.
 */

export type PaymentAttemptStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ABANDONED';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  idempotencyKey: string;
  provider: string;
  providerReference: string | null;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  authorizationUrl: string | null;
  failureReason: string | null;
  createdAt: string;
}

interface AttemptRow {
  id: string;
  order_id: string;
  idempotency_key: string;
  provider: string;
  provider_reference: string | null;
  provider_access_code: string | null;
  amount: number;
  currency: string;
  status: string;
  authorization_url: string | null;
  failure_reason: string | null;
  created_at: string;
}

function mapAttempt(row: AttemptRow): PaymentAttempt {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    idempotencyKey: String(row.idempotency_key),
    provider: String(row.provider),
    providerReference: row.provider_reference == null ? null : String(row.provider_reference),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'NGN'),
    status: String(row.status ?? 'INITIATED') as PaymentAttemptStatus,
    authorizationUrl: row.authorization_url == null ? null : String(row.authorization_url),
    failureReason: row.failure_reason == null ? null : String(row.failure_reason),
    createdAt: String(row.created_at),
  };
}

const ATTEMPT_COLUMNS = `
  id, order_id, idempotency_key, provider, provider_reference,
  provider_access_code, amount, currency, status, authorization_url,
  failure_reason, created_at
`;

export async function findAttemptByIdempotencyKey(
  key: string,
): Promise<PaymentAttempt | null> {
  const row = await one<AttemptRow>(
    `SELECT ${ATTEMPT_COLUMNS} FROM payment_attempts WHERE idempotency_key = ?`,
    [key],
  );
  return row ? mapAttempt(row) : null;
}

export async function listAttemptsForOrder(orderId: string): Promise<PaymentAttempt[]> {
  const rows = await many<AttemptRow>(
    `SELECT ${ATTEMPT_COLUMNS} FROM payment_attempts WHERE order_id = ? ORDER BY created_at DESC`,
    [orderId],
  );
  return rows.map(mapAttempt);
}

/** How many payment attempts an order has ever had (including failed ones). */
export async function countAttemptsForOrder(orderId: string): Promise<number> {
  const row = await one<{ total: number }>(
    `SELECT COUNT(*) AS total FROM payment_attempts WHERE order_id = ?`,
    [orderId],
  );
  return Number(row?.total ?? 0);
}

/** True when an attempt already uses this Paystack reference. */
async function providerReferenceTaken(reference: string): Promise<boolean> {
  const row = await one(
    `SELECT id FROM payment_attempts WHERE provider_reference = ?`,
    [reference],
  );
  return Boolean(row);
}

/** True when an attempt already uses this idempotency key. */
async function idempotencyKeyTaken(key: string): Promise<boolean> {
  const row = await one(`SELECT id FROM payment_attempts WHERE idempotency_key = ?`, [
    key,
  ]);
  return Boolean(row);
}

/**
 * Builds a provider reference and idempotency key that are unique for this
 * attempt.
 *
 * Paystack rejects a second transaction with the same reference
 * ("Duplicate transaction reference"), so every retry must send a fresh one.
 * The order reference is kept as the prefix so the reference stays readable
 * and traceable back to the order.
 */
async function buildAttemptIdentity(
  orderId: string,
  orderReference: string,
  baseIdempotencyKey: string,
): Promise<{ reference: string; idempotencyKey: string }> {
  let sequence = (await countAttemptsForOrder(orderId)) + 1;

  let reference = `WYM-${orderReference}-${sequence}`;
  while (await providerReferenceTaken(reference)) {
    sequence += 1;
    reference = `WYM-${orderReference}-${sequence}`;
  }

  let idempotencyKey = baseIdempotencyKey;
  if (await idempotencyKeyTaken(idempotencyKey)) {
    idempotencyKey = `${baseIdempotencyKey}#${sequence}`;
    while (await idempotencyKeyTaken(idempotencyKey)) {
      sequence += 1;
      idempotencyKey = `${baseIdempotencyKey}#${sequence}`;
    }
  }

  return { reference, idempotencyKey };
}

export interface StartPaymentInput {
  orderId: string;
  email: string;
  /** Reusing a key returns the existing attempt instead of charging twice. */
  idempotencyKey?: string;
  callbackUrl?: string;
}

/**
 * Starts a payment for an order.
 *
 * Throws when Paystack is not configured - the caller must not pretend the
 * payment started. When an idempotency key is reused, the existing attempt is
 * returned so a double-click cannot create two charges.
 */
export async function startPayment(
  input: StartPaymentInput,
): Promise<{
  attempt: PaymentAttempt;
  authorizationUrl: string | null;
  reused: boolean;
  message: string;
}> {
  if (!paystackConfigured()) {
    throw new Error(
      'Payments are not configured on this deployment. The order stays awaiting payment.',
    );
  }

  const order = await getOrderById(input.orderId);
  if (!order) throw new Error('Order not found.');
  if (order.status === 'PAID') {
    throw new Error('This order has already been paid.');
  }
  if (order.total <= 0) {
    throw new Error('This order has no payable amount.');
  }

  const baseIdempotencyKey = input.idempotencyKey ?? `${order.id}:${order.total}`;

  const existing = await findAttemptByIdempotencyKey(baseIdempotencyKey);
  if (existing && existing.status === 'SUCCESS') {
    return {
      attempt: existing,
      authorizationUrl: null,
      reused: true,
      message: 'This order has already been paid.',
    };
  }
  // A live attempt (INITIATED or PENDING) is reused so a double-click cannot
  // create two charges. A FAILED/ABANDONED attempt is terminal: the customer is
  // starting a new checkout, so it needs a fresh reference.
  if (
    existing &&
    (existing.status === 'INITIATED' || existing.status === 'PENDING') &&
    existing.authorizationUrl
  ) {
    return {
      attempt: existing,
      authorizationUrl: existing.authorizationUrl,
      reused: true,
      message: 'Reusing the existing payment session.',
    };
  }

  const { reference, idempotencyKey } = await buildAttemptIdentity(
    order.id,
    order.reference,
    baseIdempotencyKey,
  );
  const now = nowIso();

  const initialised = await initialisePayment({
    reference,
    amount: order.total,
    currency: order.currency,
    email: input.email,
    callbackUrl: input.callbackUrl,
    metadata: { order_id: order.id, order_reference: order.reference },
  });

  await run(
    `INSERT INTO payment_attempts (
       id, order_id, idempotency_key, provider, provider_reference,
       provider_access_code, amount, currency, status, authorization_url,
       raw_summary, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      order.id,
      idempotencyKey,
      'paystack',
      initialised.reference,
      initialised.accessCode,
      order.total,
      order.currency,
      'INITIATED',
      initialised.authorizationUrl,
      JSON.stringify({ authorization_url: initialised.authorizationUrl }),
      now,
      now,
    ],
  );

  await setOrderPayable(order.id, true);
  await setOrderStatus(order.id, 'AWAITING_PAYMENT');

  const attempt = await findAttemptByIdempotencyKey(idempotencyKey);
  if (!attempt) throw new Error('Payment attempt could not be read back.');

  logger.info('payment.initiated', {
    orderId: order.id,
    amount: order.total,
    currency: order.currency,
  });

  return {
    attempt,
    authorizationUrl: initialised.authorizationUrl,
    reused: false,
    message: 'Payment session created.',
  };
}

/**
 * Confirms a payment by asking Paystack what actually happened.
 *
 * This is the only path that may set an order to PAID. It checks:
 *  - Paystack reports success;
 *  - the amount charged matches the order total;
 *  - the currency matches.
 *
 * A mismatch leaves the order unpaid and records the reason, rather than
 * quietly accepting a partial or wrong-currency payment.
 */
export async function confirmPayment(
  orderId: string,
  reference: string,
): Promise<{ paid: boolean; order: Order | null; message: string }> {
  const order = await getOrderById(orderId);
  if (!order) return { paid: false, order: null, message: 'Order not found.' };

  if (order.status === 'PAID') {
    return { paid: true, order, message: 'This order was already paid.' };
  }

  if (!paystackConfigured()) {
    return {
      paid: false,
      order,
      message: 'Paystack is not configured, so this payment cannot be verified.',
    };
  }

  let verification;
  try {
    verification = await verifyPayment(reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('payment.verify.failed', { orderId, reference, error: message });
    return { paid: false, order, message: `Could not verify the payment: ${message}` };
  }

  const now = nowIso();

  if (!verification.paid) {
    await run(
      `UPDATE payment_attempts SET status = ?, failure_reason = ?, updated_at = ?
       WHERE provider_reference = ?`,
      ['FAILED', `Paystack status: ${verification.raw.status ?? 'unknown'}`, now, reference],
    );
    return {
      paid: false,
      order,
      message: 'Paystack has not confirmed this payment yet.',
    };
  }

  const amountMatches = Math.abs(verification.amount - order.total) < 0.01;
  const currencyMatches = verification.currency === order.currency;

  if (!amountMatches || !currencyMatches) {
    await run(
      `UPDATE payment_attempts SET status = ?, failure_reason = ?, updated_at = ?
       WHERE provider_reference = ?`,
      [
        'FAILED',
        `Amount or currency mismatch: charged ${verification.amount} ${verification.currency}, expected ${order.total} ${order.currency}`,
        now,
        reference,
      ],
    );
    logger.warn('payment.mismatch', {
      orderId,
      charged: verification.amount,
      expected: order.total,
      currency: verification.currency,
    });
    return {
      paid: false,
      order,
      message: `Payment amount does not match this order (charged ${verification.amount} ${verification.currency}, expected ${order.total} ${order.currency}). Our team has been notified.`,
    };
  }

  await run(
    `UPDATE payment_attempts SET status = ?, provider_access_code = ?, verified_at = ?, updated_at = ?
     WHERE provider_reference = ?`,
    ['SUCCESS', verification.accessCode, now, now, reference],
  );

  await setOrderStatus(order.id, 'PAID', 'CONFIRMED');

  await run(
    `INSERT INTO payment_events (
       id, event_id, provider, provider_reference, event_type, status,
       amount, currency, payload, processed_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      `confirm-${order.id}-${Date.now()}`,
      'paystack',
      reference,
      'charge.success',
      'SUCCESS',
      verification.amount,
      verification.currency,
      JSON.stringify(verification.raw),
      now,
      now,
    ],
  );

  const updated = await getOrderById(order.id);
  logger.info('payment.confirmed', { orderId, amount: verification.amount });

  return { paid: true, order: updated, message: 'Payment confirmed.' };
}

/**
 * Records a Paystack webhook event.
 *
 * The `event_id` column is unique, so a webhook that Paystack retries cannot
 * be processed twice.
 */
export async function recordPaymentEvent(input: {
  eventId: string;
  reference: string | null;
  eventType: string;
  status: string;
  amount: number | null;
  currency: string | null;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const now = nowIso();
  const existing = await one('SELECT id FROM payment_events WHERE event_id = ?', [
    input.eventId,
  ]);
  if (existing) return false;

  await run(
    `INSERT INTO payment_events (
       id, event_id, provider, provider_reference, event_type, status,
       amount, currency, payload, processed_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      input.eventId,
      'paystack',
      input.reference,
      input.eventType,
      input.status,
      input.amount,
      input.currency,
      JSON.stringify(input.payload),
      now,
      now,
    ],
  );
  return true;
}
test  
