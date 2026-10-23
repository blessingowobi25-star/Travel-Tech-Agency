import { getEnv } from '@/config/env';
import { logger } from '@/lib/logger';
import type { DbDriver } from './driver';
import { SqliteDriver } from './sqlite-driver';

/**
 * Returns the active database driver.
 *
 * DATABASE_URL set  -> PostgreSQL (Supabase or any managed Postgres).
 * DATABASE_URL unset-> bundled SQLite file (development / automated tests only).
 */
let driver: DbDriver | null = null;
let driverPromise: Promise<DbDriver> | null = null;

async function createDriver(): Promise<DbDriver> {
  const env = getEnv();
  if (env.DATABASE_URL) {
    const { PostgresDriver } = await import('./pg-driver');
    logger.info('db.driver', { dialect: 'postgres' });
    return new PostgresDriver(
      env.DATABASE_URL,
      env.DATABASE_SSL,
      env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    );
  }
  const file = process.env.SQLITE_FILE ?? '.data/waymark.db';
  logger.info('db.driver', { dialect: 'sqlite', file });
  return new SqliteDriver(file);
}

export async function getDb(): Promise<DbDriver> {
  if (driver) return driver;
  if (!driverPromise) {
    driverPromise = createDriver().then((d) => {
      driver = d;
      return d;
    });
  }
  return driverPromise;
}

/** Test helper - drops the cached driver so a new DATABASE_URL takes effect. */
export async function resetDb(): Promise<void> {
  if (driver) {
    await driver.close().catch(() => undefined);
  }
  driver = null;
  driverPromise = null;
}

/**
 * Small query helpers used by the repository layer.
 * `?` placeholders are portable across both drivers.
 */
export async function getDialect(): Promise<'sqlite' | 'postgres'> {
  const db = await getDb();
  return db.dialect;
}

/**
 * Converts a boolean into the value the active dialect expects for a
 * boolean column: `0`/`1` for SQLite, `true`/`false` for Postgres.
 *
 * Always use this for boolean columns. Writing a literal `1` into a Postgres
 * BOOLEAN column raises a type error, and writing `true` into a SQLite
 * INTEGER column is rejected by `node:sqlite`'s strict typing.
 */
export async function boolParam(value: boolean): Promise<boolean | number> {
  const db = await getDb();
  return db.dialect === 'sqlite' ? (value ? 1 : 0) : value;
}

/**
 * Renders a boolean as a SQL literal for use in a WHERE clause.
 *
 * `is_published = 1` works on SQLite but Postgres BOOLEAN rejects the integer,
 * so comparisons must be built from this helper instead of hard-coding a value.
 */
export async function boolLiteral(value: boolean): Promise<string> {
  const db = await getDb();
  if (db.dialect === 'sqlite') return value ? '1' : '0';
  return value ? 'TRUE' : 'FALSE';
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): Promise<T | null> {
  const db = await getDb();
  const { rows } = await db.query<T>(sql, params);
  return rows[0] ?? null;
}

export async function many<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): Promise<T[]> {
  const db = await getDb();
  const { rows } = await db.query<T>(sql, params);
  return rows;
}

export async function run(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): Promise<{ rowCount: number }> {
  const db = await getDb();
  const res = await db.query(sql, params);
  return { rowCount: res.rowCount };
}
