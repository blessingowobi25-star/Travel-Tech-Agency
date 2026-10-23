import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from './load-env';
import { getEnv } from '../src/config/env';
import { getDb, resetDb } from '../src/db/client';
import { tables } from '../src/db/schema';
import { logger } from '../src/lib/logger';

loadEnvFile();

/**
 * Wipes the local development database.
 *
 * Safety rules, in order:
 *   1. Refuses to run when NODE_ENV is "production".
 *   2. Refuses to touch a PostgreSQL DATABASE_URL unless --force is passed,
 *      because that is a shared database even in development.
 *   3. Refuses to run without an explicit confirmation flag (--yes) unless the
 *      script is attached to an interactive terminal, in which case it prompts.
 *
 * Flags:
 *   --yes        confirm the reset without prompting
 *   --force      allow resetting a PostgreSQL-backed database
 *   --keep-schema  only delete the data rows, keep the tables
 */
const args = new Set(process.argv.slice(2));
const confirmed = args.has('--yes') || args.has('-y');
const force = args.has('--force');
const keepSchema = args.has('--keep-schema');

const env = getEnv();

async function confirm(prompt: string): Promise<boolean> {
  if (confirmed) return true;
  if (!process.stdin.isTTY) {
    console.error(
      'Refusing to reset without confirmation. Re-run with --yes to confirm non-interactively.',
    );
    return false;
  }
  process.stdout.write(`${prompt} Type "reset" to confirm: `);
  const answer = await new Promise<string>((resolveAnswer) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => resolveAnswer(String(chunk).trim()));
    process.stdin.resume();
  });
  process.stdin.pause();
  return answer === 'reset';
}

/** Deletes the local SQLite file (and its WAL sidecars). */
function resetSqliteFile(): boolean {
  const file = resolve(process.cwd(), process.env.SQLITE_FILE ?? '.data/waymark.db');
  if (!existsSync(file)) {
    console.log(`No local database found at ${file}.`);
    return false;
  }
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${file}${suffix}`, { force: true });
  }
  console.log(`Deleted ${file}.`);
  return true;
}

/**
 * Deletes every row from the application tables, leaving the schema in place.
 *
 * SQLite has no TRUNCATE and no multi-table DELETE, so each table is cleared
 * individually. Foreign key enforcement is suspended for the duration because
 * the parents and children are cleared in one pass.
 */
async function truncateAll(): Promise<void> {
  const db = await getDb();

  if (db.dialect === 'sqlite') {
    await db.query('PRAGMA foreign_keys = OFF');
    for (const table of tables) {
      await db.query(`DELETE FROM "${table.name}"`);
    }
    await db.query('PRAGMA foreign_keys = ON');
  } else {
    // Postgres can clear every table in a single statement; CASCADE handles
    // the foreign keys that point between them.
    const names = tables.map((t) => `"${t.name}"`).join(', ');
    await db.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }

  console.log(`Cleared ${tables.length} tables (${db.dialect}).`);
}

async function main() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to reset: NODE_ENV is "production".');
    process.exitCode = 1;
    return;
  }

  const usingPostgres = Boolean(env.DATABASE_URL);
  if (usingPostgres && !force) {
    console.error(
      'Refusing to reset a PostgreSQL-backed database without --force. ' +
        'DATABASE_URL points at a database that may be shared.',
    );
    process.exitCode = 1;
    return;
  }

  const target = usingPostgres
    ? 'the PostgreSQL database from DATABASE_URL'
    : 'the local SQLite development database';
  console.log(`This will reset ${target}.`);

  if (!(await confirm(`Reset ${target}?`))) {
    console.log('Reset cancelled.');
    return;
  }

  if (usingPostgres) {
    await truncateAll();
  } else if (keepSchema) {
    await truncateAll();
  } else {
    resetSqliteFile();
  }

  logger.info('db.reset', { dialect: usingPostgres ? 'postgres' : 'sqlite' });
  console.log('Reset complete. Run "npm run db:migrate && npm run db:seed" to rebuild.');
}

main()
  .catch((error) => {
    console.error('Reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await resetDb();
  });
