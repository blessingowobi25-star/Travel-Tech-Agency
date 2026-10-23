'use server';

import { initialisePayment, paystackConfigured, verifyPayment } from '@/lib/payments/paystack';
import { providerReferenceTaken, idempotencyKeyTaken, findAttemptByIdempotencyKey, listAttemptsForOrder, countAttemptsForOrder } from '@/lib/payments/helpers';
import { run } from '@/db/client';
import { newId, nowIso } from '@/db/ids';
import { getOrderById, setOrderPayable, setOrderStatus, OrderStatus } from '@/repositories/orders';
import type { Order } from '@/types/domain';
import { logger } from '@/lib/logger';

export async function initiatePaymentAction(
  orderId: string,
  email: string,
  callbackUrl?: string
) {
  'use server';
  const order = await getOrderById(orderId);
  if (!order) {
    return { success: false, error: 'Order not found.' };
  }

  // Check if order is payable
  if (order.status !== 'DRAFT' && order.status !== 'AWAITING_PAYMENT') {
    return { success: false, error: 'Order is not in a payable state.' };
  }

  // Check existing payment attempts
  const existingAttempts = await listAttemptsForOrder(orderId);
  if (existingAttempts.length > 0) {
    return { success: false, error: 'Payment already initiated for this order.' };
  }

  // Check idempotency key availability
  const baseKey = `order_${orderId}_${Date.now()}`;
  const keyTaken = await idempotencyKeyTaken(baseKey);
  if (keyTaken) {
    return { success: false, error: 'Idempotency key conflict.' };
  }

  // Initialise payment with Paystack
  const initialised = await initialisePayment({
    reference: baseKey,
    email,
    amount: order.total,
    currency: order.currency,
    callbackUrl,
    metadata: { order_id: orderId, order_reference: order.reference },
  });

  if (!initialised || !initialised.authorizationUrl) {
    return { success: false, error: 'Failed to initialise payment.' };
  }

  return {
    success: true,
    authorizationUrl: initialised.authorizationUrl,
    reference: initialised.reference,
    idempotencyKey: baseKey,
  };
}

export async function verifyPaymentAction(
  reference: string,
  amount: number,
  currency: string
) {
  'use server';
  // Check if provider reference already taken
  const taken = await providerReferenceTaken(reference);
  if (taken) {
    const existing = await findAttemptByIdempotencyKey(reference);
    if (existing) {
      const order = await getOrderById(existing.orderId);
      return { paid: order?.status === 'PAID', order, message: 'Payment already recorded.' };
    }
  }

  // Verify with Paystack
  const verification = await verifyPayment(reference);
  if (!verification) {
    await run(
      `UPDATE payment_attempts SET status = ?, failure_reason = ?, updated_at = ? WHERE provider_reference = ?`,
      ['FAILED', 'Paystack verification failed', nowIso(), reference],
    );
    return { paid: false, message: 'Payment verification failed.' };
  }

  // ... (rest of verification logic would continue here)
  // For now, return basic result
  return { success: true, verification };
}