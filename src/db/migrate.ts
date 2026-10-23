import { getDb } from './client';
import { logger } from '@/lib/logger';
import { createIndexSql, createTableSql, schemaMigrationsTable, tables } from './schema';
import { nowIso } from './ids';

/**
 * Applies the portable schema.
 *
 * Idempotent: every DDL statement uses IF NOT EXISTS, so re-running is safe.
 * The `schema_migrations` ledger records which schema revisions have been
 * applied and is only written when the revision is genuinely new - running the
 * migration twice must not produce a second ledger row.
 *
 * For the authoritative Postgres/Supabase schema (with Row Level Security)
 * see `supabase/migrations` and docs/DATABASE.md.
 */

/** The schema revision this module applies. Bump when the tables change. */
export const SCHEMA_REVISION = 'portable-schema-v1';

export async function migrate(): Promise<{
  applied: string[];
  dialect: string;
  alreadyApplied: boolean;
}> {
  const db = await getDb();
  const applied: string[] = [];

  await db.query(schemaMigrationsTable);

  const existing = await db.query<{ name: string }>(
    'SELECT "name" FROM "schema_migrations" WHERE "name" = ?',
    [SCHEMA_REVISION],
  );
  const alreadyApplied = existing.rows.length > 0;

  for (const table of tables) {
    await db.query(createTableSql(table, db.dialect));
    applied.push(table.name);
    for (const indexSql of createIndexSql(table)) {
      await db.query(indexSql);
    }
  }

  // Only record the revision once. IF NOT EXISTS on the table alone does not
  // stop a duplicate ledger row, which would break migration history.
  if (!alreadyApplied) {
    await db.query(
      `INSERT INTO "schema_migrations" ("name", "applied_at") VALUES (?, ?)`,
      [SCHEMA_REVISION, nowIso()],
    );
  }

  logger.info('db.migrated', {
    dialect: db.dialect,
    tables: applied.length,
    revision: SCHEMA_REVISION,
    alreadyApplied,
  });
  return { applied, dialect: db.dialect, alreadyApplied };
}
