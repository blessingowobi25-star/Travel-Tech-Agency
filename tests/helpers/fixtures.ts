/**
 * Fixtures shared by the payment tests.
 */
import { registerUser } from '@/lib/auth/service';
import { createOrder } from '@/repositories/orders';
import type { Order } from '@/types/domain';

let sequence = 0;

/** Registers a throwaway customer. */
export async function makeCustomer(email = 'customer@waymark.test') {
  sequence += 1;
  return registerUser({
    email,
    password: 'Waymark123!',
    fullName: `Test Customer ${sequence}`,
    role: 'customer',
  });
}

/** Creates an order with a known total. */
export async function makeOrder(options?: {
  userId?: string;
  total?: number;
  currency?: string;
}): Promise<Order> {
  const total = options?.total ?? 100_000;
  return createOrder({
    userId: options?.userId ?? null,
    currency: options?.currency ?? 'NGN',
    fees: 0,
    items: [
      {
        description: 'Test trip package',
        quantity: 1,
        unitPrice: total,
        amount: total,
        category: 'package',
      },
    ],
  });
}
