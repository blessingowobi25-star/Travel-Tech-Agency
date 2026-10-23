import { many, one, run } from '@/db/client';
import { newId, newReference, nowIso } from '@/db/ids';
import { type Enquiry, type EnquiryStatus, mapEnquiry } from '@/types/domain';

const ENQUIRY_COLUMNS = `
  id, reference, user_id, service, contact_name, contact_email, contact_phone,
  party_size, departure_city, travel_start_date, flexibility, budget_amount,
  budget_currency, details, status, owner_id, destination_id, created_at
`;

export interface CreateEnquiryInput {
  userId?: string | null;
  service: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  partySize?: number | null;
  departureCity?: string | null;
  travelStartDate?: string | null;
  flexibility?: string | null;
  budgetAmount?: number | null;
  budgetCurrency?: string;
  details: string;
  destinationId?: string | null;
}

/** Valid status transitions for the enquiry pipeline. */
const TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['QUOTED', 'CLOSED'],
  QUOTED: ['CONFIRMED', 'IN_REVIEW', 'CLOSED'],
  CONFIRMED: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export async function createEnquiry(input: CreateEnquiryInput): Promise<Enquiry> {
  const id = newId();
  const now = nowIso();

  // Retry on the (vanishingly unlikely) reference collision rather than
  // failing the customer's request.
  let reference = newReference('ENQ');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await one('SELECT id FROM enquiries WHERE reference = ?', [reference]);
    if (!clash) break;
    reference = newReference('ENQ');
  }

  await run(
    `INSERT INTO enquiries (
       id, reference, user_id, service, contact_name, contact_email, contact_phone,
       party_size, departure_city, travel_start_date, flexibility, budget_amount,
       budget_currency, details, status, destination_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reference,
      input.userId ?? null,
      input.service,
      input.contactName.trim(),
      input.contactEmail.trim().toLowerCase(),
      input.contactPhone?.trim() ?? null,
      input.partySize ?? null,
      input.departureCity?.trim() ?? null,
      input.travelStartDate ?? null,
      input.flexibility ?? null,
      input.budgetAmount ?? null,
      input.budgetCurrency ?? 'NGN',
      input.details.trim(),
      'NEW',
      input.destinationId ?? null,
      now,
      now,
    ],
  );

  const created = await getEnquiryById(id);
  if (!created) throw new Error('Enquiry could not be read back after creation.');
  return created;
}

export async function getEnquiryById(id: string): Promise<Enquiry | null> {
  const row = await one(`SELECT ${ENQUIRY_COLUMNS} FROM enquiries WHERE id = ?`, [id]);
  return row ? mapEnquiry(row) : null;
}

export async function getEnquiryByReference(
  reference: string,
): Promise<Enquiry | null> {
  const row = await one(`SELECT ${ENQUIRY_COLUMNS} FROM enquiries WHERE reference = ?`, [
    reference,
  ]);
  return row ? mapEnquiry(row) : null;
}

export interface EnquiryFilters {
  userId?: string;
  status?: EnquiryStatus;
  service?: string;
  limit?: number;
  offset?: number;
}

export async function listEnquiries(
  filters: EnquiryFilters = {},
): Promise<Enquiry[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.userId) {
    where.push('user_id = ?');
    params.push(filters.userId);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.service) {
    where.push('service = ?');
    params.push(filters.service);
  }

  params.push(filters.limit ?? 50, filters.offset ?? 0);

  const rows = await many<Record<string, unknown>>(
    `SELECT ${ENQUIRY_COLUMNS} FROM enquiries
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );
  return rows.map(mapEnquiry);
}

/**
 * Moves an enquiry to a new status and records the change.
 *
 * Throws when the transition is not allowed by the pipeline so an operator
 * cannot accidentally skip a stage.
 */
export async function updateEnquiryStatus(
  enquiryId: string,
  toStatus: EnquiryStatus,
  actor: { id?: string | null; label?: string | null; note?: string | null } = {},
): Promise<Enquiry> {
  const enquiry = await getEnquiryById(enquiryId);
  if (!enquiry) throw new Error('Enquiry not found.');

  if (!canTransition(enquiry.status, toStatus)) {
    throw new Error(`Cannot move enquiry from ${enquiry.status} to ${toStatus}.`);
  }

  const now = nowIso();
  await run('UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ?', [
    toStatus,
    now,
    enquiryId,
  ]);
  await run(
    `INSERT INTO enquiry_events (id, enquiry_id, from_status, to_status, note, actor_id, actor_label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      enquiryId,
      enquiry.status,
      toStatus,
      actor.note ?? null,
      actor.id ?? null,
      actor.label ?? null,
      now,
    ],
  );

  const updated = await getEnquiryById(enquiryId);
  if (!updated) throw new Error('Enquiry could not be read back after update.');
  return updated;
}

export async function assignEnquiry(
  enquiryId: string,
  ownerId: string | null,
): Promise<void> {
  await run('UPDATE enquiries SET owner_id = ?, updated_at = ? WHERE id = ?', [
    ownerId,
    nowIso(),
    enquiryId,
  ]);
}

export interface EnquiryEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actorLabel: string | null;
  createdAt: string;
}

export async function listEnquiryEvents(enquiryId: string): Promise<EnquiryEvent[]> {
  const rows = await many<Record<string, unknown>>(
    `SELECT id, from_status, to_status, note, actor_label, created_at
     FROM enquiry_events WHERE enquiry_id = ? ORDER BY created_at ASC`,
    [enquiryId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    fromStatus: row.from_status == null ? null : String(row.from_status),
    toStatus: String(row.to_status),
    note: row.note == null ? null : String(row.note),
    actorLabel: row.actor_label == null ? null : String(row.actor_label),
    createdAt: String(row.created_at),
  }));
}

