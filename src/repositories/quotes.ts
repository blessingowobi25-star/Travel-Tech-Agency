import { many, one, run } from '@/db/client';
import { newId, newReference, nowIso } from '@/db/ids';
import { type Quote, type QuoteItem, type QuoteStatus, mapQuote } from '@/types/domain';

const QUOTE_COLUMNS = `
  id, reference, enquiry_id, user_id, currency, subtotal, fees, total, status,
  expires_at, terms, notes, created_at
`;

export interface CreateQuoteInput {
  enquiryId: string;
  userId?: string | null;
  currency?: string;
  items: Omit<QuoteItem, 'id' | 'position'>[];
  fees?: number;
  terms?: string | null;
  notes?: string | null;
  expiresAt?: string | null;
  status?: QuoteStatus;
}

/** Rounds to 2 decimal places and avoids float drift in totals. */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const id = newId();
  const now = nowIso();
  const currency = input.currency ?? 'NGN';

  let reference = newReference('QUO');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await one('SELECT id FROM quotes WHERE reference = ?', [reference]);
    if (!clash) break;
    reference = newReference('QUO');
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
    `INSERT INTO quotes (
       id, reference, enquiry_id, user_id, currency, subtotal, fees, total,
       status, expires_at, terms, notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reference,
      input.enquiryId,
      input.userId ?? null,
      currency,
      subtotal,
      fees,
      total,
      input.status ?? 'DRAFT',
      input.expiresAt ?? null,
      input.terms ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  for (const item of items) {
    await run(
      `INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, amount, category, position, created_at)
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

  const created = await getQuoteById(id);
  if (!created) throw new Error('Quote could not be read back after creation.');
  return created;
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  const row = await one(`SELECT ${QUOTE_COLUMNS} FROM quotes WHERE id = ?`, [id]);
  if (!row) return null;
  return mapQuote(row, await listQuoteItems(id));
}

export async function getQuoteByReference(
  reference: string,
): Promise<Quote | null> {
  const row = await one(`SELECT ${QUOTE_COLUMNS} FROM quotes WHERE reference = ?`, [
    reference,
  ]);
  if (!row) return null;
  return mapQuote(row, await listQuoteItems(String(row.id)));
}

export async function listQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT id, description, quantity, unit_price, amount, category, position
     FROM quote_items WHERE quote_id = ? ORDER BY position ASC`,
    [quoteId],
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

export async function listQuotesByEnquiry(
  enquiryId: string,
): Promise<Quote[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT ${QUOTE_COLUMNS} FROM quotes WHERE enquiry_id = ? ORDER BY created_at DESC`,
    [enquiryId],
  );
  const quotes: Quote[] = [];
  for (const row of rows) {
    quotes.push(mapQuote(row, await listQuoteItems(String(row.id))));
  }
  return quotes;
}

export async function listQuotesByUser(userId: string): Promise<Quote[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT ${QUOTE_COLUMNS} FROM quotes WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  const quotes: Quote[] = [];
  for (const row of rows) {
    quotes.push(mapQuote(row, await listQuoteItems(String(row.id))));
  }
  return quotes;
}

export async function setQuoteStatus(
  quoteId: string,
  status: QuoteStatus,
  note?: string | null,
): Promise<Quote> {
  const now = nowIso();
  await run('UPDATE quotes SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    now,
    quoteId,
  ]);
  await run(
    `INSERT INTO quote_events (id, quote_id, event, note, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newId(), quoteId, status, note ?? null, now],
  );
  const updated = await getQuoteById(quoteId);
  if (!updated) throw new Error('Quote could not be read back after update.');
  return updated;
}
