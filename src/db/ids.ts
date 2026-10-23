import { randomUUID } from 'node:crypto';

/** UUIDv4 identifier. Used as the primary key strategy across the app. */
export function newId(): string {
  return randomUUID();
}

/** ISO-8601 timestamp string, used for all `created_at`/`updated_at` values. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Human-friendly reference numbers, e.g. ENQ-7F3K9A.
 * The random suffix makes collisions practically impossible for an MVP and the
 * unique index on the column is the real guarantee.
 */
export function newReference(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${suffix}`;
}

/**
 * Converts a boolean to the value the active dialect expects.
 * SQLite stores 0/1, Postgres stores true/false. `pg` and `node:sqlite` both
 * accept booleans for numeric columns, but SQLite is strict about types, so we
 * normalise here.
 */
export function toDbBool(value: boolean): number {
  return value ? 1 : 0;
}

/** Reads a boolean column that may come back as 0/1, true/false or 't'/'f'. */
export function fromDbBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return value === 'true' || value === 't' || value === '1';
  }
  return false;
}

/** Safely parses a JSON column that may be a string or already an object. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Serialises a value for a JSON column. */
export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
