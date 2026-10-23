/**
 * Payment lifecycle regression tests.
 *
 * These cover the order -> payment -> paid path end to end against an
 * isolated in-memory database and a fake Paystack. The scenarios that matter
 * most are the ones a real customer hits: paying twice, paying after a
 * failure, and paying after a mismatch.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { many } from '@/db/client';
import {
  confirmPayment,
  listAttemptsForOrder,
  recordPaymentEvent,
  startPayment,
} from '@/lib/payments/service';
import { getOrderById } from '@/repositories/orders';
import { ensureSchema, resetTables } from './helpers/db';
import { installPaystackFetch } from './helpers/fetch-stub';
import { makeOrder } from './helpers/fixtures';
import { paystackFake } from './helpers/paystack-fake';

let restoreFetch: () => void;

beforeAll(async () => {
  await ensureSchema();
  restoreFetch = installPaystackFetch();
});

afterAll(() => {
  restoreFetch();
});

beforeEach(async () => {
  await resetTables();
  paystackFake.reset();
});

describe('startPayment', () => {
  it('creates a payment attempt and marks the order as awaiting payment', async () => {
    const order = await makeOrder();

    const result = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
    });

    expect(result.reused).toBe(false);
    expect(result.attempt.status).toBe('INITIATED');
    expect(result.attempt.amount).toBe(100_000);
    expect(result.authorizationUrl).toBeTruthy();

    const attempts = await listAttemptsForOrder(order.id);
    expect(attempts).toHaveLength(1);

    const updated = await getOrderById(order.id);
    expect(updated?.status).toBe('AWAITING_PAYMENT');
    expect(updated?.payable).toBe(true);
  });

  it('reuses the existing attempt when the same idempotency key is replayed', async () => {
    const order = await makeOrder();

    const first = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const second = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });

    expect(second.reused).toBe(true);
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(second.authorizationUrl).toBe(first.authorizationUrl);

    const attempts = await listAttemptsForOrder(order.id);
    expect(attempts).toHaveLength(1);
    // Only one Paystack transaction was created - no double charge risk.
    expect(paystackFake.transactions).toHaveLength(1);
  });

  it('refuses to start a payment for an order that has already been paid', async () => {
    const order = await makeOrder();

    await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = paystackFake.transactions[0].reference;
    paystackFake.setStatus(reference, 'success');
    await confirmPayment(order.id, reference);

    await expect(
      startPayment({
        orderId: order.id,
        email: 'customer@waymark.test',
        idempotencyKey: 'checkout-2',
      }),
    ).rejects.toThrow(/already been paid/i);
  });

  it('refuses to start a payment for an unknown order', async () => {
    await expect(
      startPayment({ orderId: 'does-not-exist', email: 'a@b.test' }),
    ).rejects.toThrow(/not found/i);
  });
});

describe('startPayment retries', () => {
  it('starts a fresh Paystack transaction when the previous attempt failed', async () => {
    const order = await makeOrder();

    const first = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const firstReference = paystackFake.transactions[0].reference;

    // The customer abandons the first checkout, so Paystack reports it as
    // abandoned and the attempt is marked FAILED.
    paystackFake.setStatus(firstReference, 'abandoned');
    const confirm = await confirmPayment(order.id, firstReference);
    expect(confirm.paid).toBe(false);

    const attemptsAfterFailure = await listAttemptsForOrder(order.id);
    expect(attemptsAfterFailure[0].status).toBe('FAILED');

    // The customer tries to pay again.
    const retry = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-2',
    });

    expect(retry.reused).toBe(false);
    expect(retry.attempt.id).not.toBe(first.attempt.id);
    expect(retry.attempt.status).toBe('INITIATED');
    expect(retry.authorizationUrl).toBeTruthy();
    expect(retry.authorizationUrl).not.toBe(first.authorizationUrl);

    // A second Paystack transaction was created.
    expect(paystackFake.transactions).toHaveLength(2);
    expect(paystackFake.transactions[1].reference).not.toBe(firstReference);
  });

  it('keeps the failed attempt and its history when a retry succeeds', async () => {
    const order = await makeOrder();

    const first = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const firstReference = paystackFake.transactions[0].reference;
    paystackFake.setStatus(firstReference, 'abandoned');
    await confirmPayment(order.id, firstReference);

    const retry = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-2',
    });
    const retryReference = paystackFake.transactions[1].reference;
    paystackFake.setStatus(retryReference, 'success');

    const confirmed = await confirmPayment(order.id, retryReference);
    expect(confirmed.paid).toBe(true);

    const attempts = await listAttemptsForOrder(order.id);
    expect(attempts).toHaveLength(2);

    // The audit trail is preserved: the old failure is still on record.
    const failed = attempts.find((a) => a.id === first.attempt.id);
    expect(failed?.status).toBe('FAILED');
    expect(failed?.failureReason).toBeTruthy();

    const succeeded = attempts.find((a) => a.id === retry.attempt.id);
    expect(succeeded?.status).toBe('SUCCESS');
  });

  it('retries with a reference Paystack has not seen before', async () => {
    const order = await makeOrder();

    const first = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    paystackFake.setStatus(paystackFake.transactions[0].reference, 'abandoned');
    await confirmPayment(order.id, paystackFake.transactions[0].reference);

    // If the retry reused the original reference, Paystack would reject it
    // with "Duplicate transaction reference" and the customer would be stuck.
    const retry = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-2',
    });

    expect(retry.attempt.providerReference).not.toBe(first.attempt.providerReference);
    expect(paystackFake.transactions).toHaveLength(2);
  });
});


describe('confirmPayment', () => {
  it('marks the order as paid when Paystack confirms the charge', async () => {
    const order = await makeOrder();

    const started = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = started.attempt.providerReference!;
    paystackFake.setStatus(reference, 'success');

    const result = await confirmPayment(order.id, reference);

    expect(result.paid).toBe(true);
    expect(result.order?.status).toBe('PAID');
    expect(result.order?.fulfilmentStatus).toBe('CONFIRMED');

    const attempts = await listAttemptsForOrder(order.id);
    expect(attempts[0].status).toBe('SUCCESS');

    const events = await many('SELECT * FROM payment_events WHERE provider_reference = ?', [
      reference,
    ]);
    expect(events).toHaveLength(1);
  });

  it('does not mark the order as paid when the charged amount does not match', async () => {
    const order = await makeOrder();

    const started = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = started.attempt.providerReference!;
    paystackFake.setStatus(reference, 'success');

    // The customer pays a different amount than the order total.
    paystackFake.transactions[0].amount = 40_000;

    const result = await confirmPayment(order.id, reference);

    expect(result.paid).toBe(false);
    expect(result.message).toMatch(/does not match/i);

    const updated = await getOrderById(order.id);
    expect(updated?.status).toBe('AWAITING_PAYMENT');

    const attempts = await listAttemptsForOrder(order.id);
    expect(attempts[0].status).toBe('FAILED');
    expect(attempts[0].failureReason).toMatch(/mismatch/i);
  });

  it('does not mark the order as paid when the currency does not match', async () => {
    const order = await makeOrder();

    const started = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = started.attempt.providerReference!;
    paystackFake.setStatus(reference, 'success');
    paystackFake.transactions[0].currency = 'USD';

    const result = await confirmPayment(order.id, reference);

    expect(result.paid).toBe(false);
    expect((await getOrderById(order.id))?.status).toBe('AWAITING_PAYMENT');
  });

  it('leaves the order unpaid when Paystack has not confirmed the payment', async () => {
    const order = await makeOrder();

    const started = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = started.attempt.providerReference!;

    const result = await confirmPayment(order.id, reference);

    expect(result.paid).toBe(false);
    expect((await getOrderById(order.id))?.status).toBe('AWAITING_PAYMENT');
  });

  it('reports a verification failure without changing the order', async () => {
    const order = await makeOrder();

    const started = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = started.attempt.providerReference!;
    paystackFake.failVerificationFor.add(reference);

    const result = await confirmPayment(order.id, reference);

    expect(result.paid).toBe(false);
    expect(result.message).toMatch(/could not verify/i);
    expect((await getOrderById(order.id))?.status).toBe('AWAITING_PAYMENT');
  });

  it('is idempotent - confirming twice does not double-pay', async () => {
    const order = await makeOrder();

    const started = await startPayment({
      orderId: order.id,
      email: 'customer@waymark.test',
      idempotencyKey: 'checkout-1',
    });
    const reference = started.attempt.providerReference!;
    paystackFake.setStatus(reference, 'success');

    const first = await confirmPayment(order.id, reference);
    const second = await confirmPayment(order.id, reference);

    expect(first.paid).toBe(true);
    expect(second.paid).toBe(true);

    const events = await many('SELECT * FROM payment_events');
    expect(events).toHaveLength(1);
  });
});


describe('recordPaymentEvent', () => {
  it('stores a webhook event once', async () => {
    const payload = { data: { reference: 'WYM-TEST' } };

    const first = await recordPaymentEvent({
      eventId: 'evt-1',
      reference: 'WYM-TEST',
      eventType: 'charge.success',
      status: 'SUCCESS',
      amount: 100_000,
      currency: 'NGN',
      payload,
    });
    const second = await recordPaymentEvent({
      eventId: 'evt-1',
      reference: 'WYM-TEST',
      eventType: 'charge.success',
      status: 'SUCCESS',
      amount: 100_000,
      currency: 'NGN',
      payload,
    });

    expect(first).toBe(true);
    expect(second).toBe(false);

    const rows = await many('SELECT * FROM payment_events');
    expect(rows).toHaveLength(1);
  });
});

