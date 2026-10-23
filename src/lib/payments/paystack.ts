import { getEnv } from '@/config/env';

/**
 * Paystack integration.
 *
 * Works in test mode with no credentials by NOT pretending: if Paystack is not
 * configured, `paystackConfigured()` is false and the order flow refuses to
 * mark anything as paid. The caller decides what to do (the app keeps the
 * order in AWAITING_PAYMENT).
 *
 * Amounts are handled in kobo (the smallest NGN unit) because Paystack's
 * smallest unit is a currency unit. NGN has no minor unit, so 1 NGN = 1 kobo
 * as far as the API is concerned.
 */

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
    amount?: number;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    access_code?: string;
    authorization?: {
      authorization_code?: string;
      last4?: string;
      bank?: string;
    };
    customer?: {
      email?: string;
      first_name?: string;
    };
    metadata?: Record<string, unknown>;
  };
}

/** True when Paystack credentials are present and usable. */
export function paystackConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

/** Paystack amounts are integers in the currency's smallest unit. */
export function toKobo(amount: number): number {
  return Math.round(amount * 100);
}

export function fromKobo(kobo: number): number {
  return Math.round(kobo) / 100;
}

async function paystackFetch<T>(path: string, init: RequestInit): Promise<T> {
  const env = getEnv();
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured (PAYSTACK_SECRET_KEY is missing).');
  }

  const response = await fetch(`${env.PAYSTACK_API_BASE.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Paystack returned a non-JSON response (${response.status}).`);
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string })?.message ?? `Paystack error ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

// __APPEND__

export interface InitialisePaymentInput {
  /** Your own reference for the transaction. */
  reference: string;
  amount: number;
  currency?: string;
  email: string;
  /** Where Paystack sends the customer after they choose a payment method. */
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a Paystack transaction and returns the authorisation URL the
 * customer should be redirected to.
 */
export async function initialisePayment(
  input: InitialisePaymentInput,
): Promise<{
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  amount: number;
}> {
  const env = getEnv();
  const amount = toKobo(input.amount);

  const payload = await paystackFetch<PaystackInitResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount,
      currency: input.currency ?? 'NGN',
      reference: input.reference,
      callback_url: input.callbackUrl ?? `${env.APP_URL}/orders/${input.reference}`,
      metadata: input.metadata ?? {},
    }),
  });

  if (!payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message || 'Paystack did not return an authorisation URL.');
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code ?? '',
    reference: payload.data.reference ?? input.reference,
    amount: payload.data.amount ?? amount,
  };
}

/**
 * Verifies a transaction with Paystack.
 *
 * `status === 'success'` means Paystack confirmed the charge. The caller must
 * also check the amount and currency match what was expected - a successful
 * charge for the wrong amount is not a valid payment for this order.
 */
export async function verifyPayment(
  reference: string,
): Promise<{
  paid: boolean;
  amount: number;
  currency: string;
  paidAt: string | null;
  accessCode: string | null;
  authorizationCode: string | null;
  raw: Record<string, unknown>;
}> {
  const payload = await paystackFetch<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
  );

  const data = payload.data ?? {};
  const paid = Boolean(payload.status) && data.status === 'success';

  return {
    paid,
    amount: fromKobo(Number(data.amount ?? 0)),
    currency: String(data.currency ?? 'NGN'),
    paidAt: data.paid_at ?? null,
    accessCode: data.access_code ?? null,
    authorizationCode: data.authorization?.authorization_code ?? null,
    raw: data as Record<string, unknown>,
  };
}

/**
 * Computes the HMAC-SHA512 signature Paystack sends with webhook events.
 * The signed payload is the raw request body. Returns hex.
 */
export async function computeWebhookSignature(
  rawBody: string,
  secret: string,
): Promise<string> {
  const crypto = await import('node:crypto');
  return crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
}

/** Verifies a webhook signature in constant time. */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await computeWebhookSignature(rawBody, secret);
  const crypto = await import('node:crypto');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Human-readable status for the health endpoint. */
export function paystackStatus(): { configured: boolean; note: string } {
  const env = getEnv();
  if (!env.PAYSTACK_SECRET_KEY) {
    return {
      configured: false,
      note: 'Paystack is not configured. Orders stay in AWAITING_PAYMENT and cannot be marked paid.',
    };
  }
  const isTestKey = env.PAYSTACK_SECRET_KEY.startsWith('sk_test_');
  return {
    configured: true,
    note: isTestKey
      ? 'Paystack is configured in TEST mode. Use test cards, never real money.'
      : 'Paystack is configured in LIVE mode. Real payments will be taken.',
  };
}
