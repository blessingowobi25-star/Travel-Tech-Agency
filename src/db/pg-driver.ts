import { Pool, type PoolClient } from 'pg';
import type { DbDriver, QueryResult, SqlValue } from './driver';

/**
 * PostgreSQL driver used for Supabase and any managed Postgres.
 *
 * Placeholders use the `?` style everywhere in the repository; this driver
 * converts them to PostgreSQL's $1, $2, ... form.
 */
export class PostgresDriver implements DbDriver {
  readonly dialect = 'postgres' as const;
  private pool: Pool;

  constructor(connectionString: string, ssl = false, rejectUnauthorized = false) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(ssl
        ? {
            ssl: {
              rejectUnauthorized,
              ...(rejectUnauthorized ? {} : { ca: undefined }),
            },
          }
        : {}),
    });
  }

  private toPg(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<QueryResult<T>> {
    const res = await this.pool.query(this.toPg(sql), params as never[]);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  }

  async transaction<T>(fn: (tx: DbDriver) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    const scoped = new PooledClientDriver(client);
    try {
      await client.query('BEGIN');
      const result = await fn(scoped);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* keep the original error */
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** A DbDriver bound to an existing postgres client (for transactions). */
class PooledClientDriver implements DbDriver {
  readonly dialect = 'postgres' as const;

  constructor(private client: PoolClient) {}

  private toPg(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = [],
  ): Promise<QueryResult<T>> {
    const res = await this.client.query(this.toPg(sql), params as never[]);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  }

  async transaction<T>(fn: (tx: DbDriver) => Promise<T>): Promise<T> {
    // Nested transactions use savepoints.
    const name = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await this.client.query(`SAVEPOINT ${name}`);
    try {
      const result = await fn(this);
      await this.client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    /* the pool owns the client */
  }
}
