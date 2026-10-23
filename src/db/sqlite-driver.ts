import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DbDriver, QueryResult, SqlValue } from './driver';

/**
 * Local SQLite driver (Node 24 built-in `node:sqlite`).
 *
 * Intended for development and automated tests only. It is NOT a production
 * database: it is single-file, single-process and has no row level security.
 */
export class SqliteDriver implements DbDriver {
  readonly dialect = 'sqlite' as const;
  private db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') {
      mkdirSync(dirname(file), { recursive: true });
    }
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<QueryResult<T>> {
    const stmt = this.db.prepare(sql);
    const isRead = /^\s*(select|with|pragma)/i.test(sql);
    if (isRead) {
      const rows = stmt.all(...(params as never[])) as T[];
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...(params as never[]));
    return {
      rows: [],
      rowCount: Number(info.changes ?? 0),
    };
  }

  async transaction<T>(fn: (tx: DbDriver) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* the original error is more useful */
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
