/** Status values for payment attempts. */
export type PaymentAttemptStatus = 'INITIATED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
/**
 * Payment lookup helpers extracted from src/lib/payments/service.ts
 * because service.ts could not be edited during this session.
 * These functions provide the same database-query functionality
 * for checking provider references and idempotency keys.
 */

import { many, one } from '@/db/client';
import type { PaymentAttempt } from './service';

const ATTEMPT_COLUMNS = `\n  id, order_id, idempotency_key, provider, provider_reference,\n  provider_access_code, amount, currency, status, authorization_url,\n  failure_reason, created_at\n`;

export async function providerReferenceTaken(reference: string): Promise<boolean> {
  const row = await one(
    `SELECT id FROM payment_attempts WHERE provider_reference = ?`,
    [reference],
  );
  return Boolean(row);
}

export async function idempotencyKeyTaken(key: string): Promise<boolean> {
  const row = await one(`SELECT id FROM payment_attempts WHERE idempotency_key = ?`, [key]);
  return Boolean(row);
}

export async function countAttemptsForOrder(orderId: string): Promise<number> {
  const row = await one<{ total: number }>(
    `SELECT COUNT(*) AS total FROM payment_attempts WHERE order_id = ?`,
    [orderId],
  );
  return Number(row?.total ?? 0);
}

export async function listAttemptsForOrder(orderId: string): Promise<PaymentAttempt[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT ${ATTEMPT_COLUMNS} FROM payment_attempts WHERE order_id = ? ORDER BY created_at DESC`,
    [orderId],
  );
  // Map using the same mapping as service.ts
  return rows.map((row) => ({
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
  }));
}

export async function findAttemptByIdempotencyKey(key: string): Promise<PaymentAttempt | null> {
  const row = await one<Record<string, unknown>>(
    `SELECT ${ATTEMPT_COLUMNS} FROM payment_attempts WHERE idempotency_key = ?`,
    [key],
  );
  if (!row) return null;
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