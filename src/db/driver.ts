/**
 * Database driver interface.
 *
 * The application talks to this narrow interface only, so the same repository
 * code runs on the bundled local SQLite database (zero-setup development) and
 * on Supabase/PostgreSQL (production). SQL is written to be portable between
 * the two; where a difference exists the driver translates it.
 */
export type SqlValue = string | number | boolean | null | Date;

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbDriver {
  readonly dialect: 'sqlite' | 'postgres';
  query<T = Record<string, unknown>>(
    sql: string,
    params?: SqlValue[],
  ): Promise<QueryResult<T>>;
  /** Runs multiple statements in a transaction. Rolls back on any error. */
  transaction<T>(fn: (tx: DbDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Placeholder style used in repository SQL - each driver rewrites it. */
export const PLACEHOLDER = '?';
