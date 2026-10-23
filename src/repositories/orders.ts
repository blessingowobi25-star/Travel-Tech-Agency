import { boolParam, many, one, run } from '@/db/client';
import { newId, newReference, nowIso } from '@/db/ids';
import {
  type Order,
  type OrderStatus,
  type QuoteItem,
  mapOrder,
} from '@/types/domain';

export type { OrderStatus };
import { money } from './quotes';

const ORDER_COLUMNS = `
  id, reference, quote_id, enquiry_id, user_id, currency, subtotal, fees, total,
  status, fulfilment_status, payable, created_at
`;

export interface CreateOrderInput {
  quoteId?: string | null;
  enquiryId?: string | null;
  userId?: string | null;
  currency?: string;
  items: Omit<QuoteItem, 'id' | 'position'>[];
  fees?: number;
  status?: OrderStatus;
  payable?: boolean;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const id = newId();
  const now = nowIso();
  const currency = input.currency ?? 'NGN';

  let reference = newReference('ORD');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await one('SELECT id FROM orders WHERE reference = ?', [reference]);
    if (!clash) break;
    reference = newReference('ORD');
  }

  const items = input.items.map((item, index) => ({
    ...item,
    quantity: money(item.quantity),
    unitPrice: money(item.unitPrice),
    amount: money(item.quantity * item.unitPrice),
    position: index,
  }));

  const subtotal = money(items.reduce((sum, item) => sum + item.amount, 0));
  const fees = money(input.fees ?? 0);
  const total = money(subtotal + fees);

  await run(
    `INSERT INTO orders (
       id, reference, quote_id, enquiry_id, user_id, currency, subtotal, fees,
       total, status, fulfilment_status, payable, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reference,
      input.quoteId ?? null,
      input.enquiryId ?? null,
      input.userId ?? null,
      currency,
      subtotal,
      fees,
      total,
      input.status ?? 'AWAITING_PAYMENT',
      'NOT_STARTED',
      await boolParam(input.payable ?? false),
      now,
      now,
    ],
  );

  for (const item of items) {
    await run(
      `INSERT INTO order_items (id, order_id, description, quantity, unit_price, amount, category, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        id,
        item.description,
        item.quantity,
        item.unitPrice,
        item.amount,
        item.category ?? null,
        item.position,
        now,
      ],
    );
  }

  const created = await getOrderById(id);
  if (!created) throw new Error('Order could not be read back after creation.');
  return created;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const row = await one(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`, [id]);
  if (!row) return null;
  return mapOrder(row, await listOrderItems(id));
}

export async function getOrderByReference(
  reference: string,
): Promise<Order | null> {
  const row = await one(`SELECT ${ORDER_COLUMNS} FROM orders WHERE reference = ?`, [
    reference,
  ]);
  if (!row) return null;
  return mapOrder(row, await listOrderItems(String(row.id)));
}

export interface OrderFilters {
  userId?: string;
  enquiryId?: string;
  quoteId?: string;
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}

/** Lists orders with filtering. Staff use this without a userId filter. */
export async function listOrders(filters: OrderFilters = {}): Promise<Order[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.userId) {
    where.push('user_id = ?');
    params.push(filters.userId);
  }
  if (filters.enquiryId) {
    where.push('enquiry_id = ?');
    params.push(filters.enquiryId);
  }
  if (filters.quoteId) {
    where.push('quote_id = ?');
    params.push(filters.quoteId);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  params.push(filters.limit ?? 50, filters.offset ?? 0);

  const rows = await many<Record<string, unknown>>(
    `SELECT ${ORDER_COLUMNS} FROM orders
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  const orders: Order[] = [];
  for (const row of rows) {
    orders.push(mapOrder(row, await listOrderItems(String(row.id))));
  }
  return orders;
}

export async function listOrderItems(orderId: string): Promise<QuoteItem[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT id, description, quantity, unit_price, amount, category, position
     FROM order_items WHERE order_id = ? ORDER BY position ASC`,
    [orderId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    description: String(row.description),
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    amount: Number(row.amount ?? 0),
    category: row.category == null ? null : String(row.category),
    position: Number(row.position ?? 0),
  }));
}

export async function listOrdersByUser(userId: string): Promise<Order[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  const orders: Order[] = [];
  for (const row of rows) {
    orders.push(mapOrder(row, await listOrderItems(String(row.id))));
  }
  return orders;
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  fulfilmentStatus?: string,
): Promise<Order> {
  const now = nowIso();
  const sets = ['status = ?', 'updated_at = ?'];
  const params: (string | number)[] = [status, now];
  if (fulfilmentStatus) {
    sets.push('fulfilment_status = ?');
    params.push(fulfilmentStatus);
  }
  params.push(orderId);
  await run(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, params);

  const updated = await getOrderById(orderId);
  if (!updated) throw new Error('Order could not be read back after update.');
  return updated;
}

export async function setOrderPayable(
  orderId: string,
  payable: boolean,
): Promise<void> {
  await run('UPDATE orders SET payable = ?, updated_at = ? WHERE id = ?', [
    await boolParam(payable),
    nowIso(),
    orderId,
  ]);
}
