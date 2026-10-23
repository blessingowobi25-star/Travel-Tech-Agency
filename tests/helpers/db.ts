/**
 * Test database helpers.
 *
 * The suite shares a single in-memory SQLite database (one Vitest fork), so
 * every test starts by truncating the data tables. The schema is created once
 * by the global setup and left in place.
 */
import { getDb, resetDb } from '@/db/client';
import { migrate } from '@/db/migrate';

/** Tables that hold test data. `schema_migrations` is left alone. */
const DATA_TABLES = [
  'ai_usage',
  'notifications',
  'audit_logs',
  'payment_events',
  'payment_attempts',
  'order_items',
  'orders',
  'quote_events',
  'quote_items',
  'quotes',
  'enquiries',
  'itinerary_activities',
  'itinerary_days',
  'saved_trips',
  'messages',
  'conversations',
  'traveller_profiles',
  'destinations',
  'password_reset_tokens',
  'sessions',
  'users',
];

let migrated = false;

/** Creates the schema once per process. */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  await migrate();
  migrated = true;
}

/** Empties every data table so each test starts from a known state. */
export async function resetTables(): Promise<void> {
  const db = await getDb();
  await db.query('PRAGMA foreign_keys = OFF');
  for (const table of DATA_TABLES) {
    await db.query(`DELETE FROM ${table}`);
  }
  await db.query('PRAGMA foreign_keys = ON');
}

/** Drops the cached driver entirely (used when switching database files). */
export { resetDb };
