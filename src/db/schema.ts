/**
 * Portable schema definition.
 *
 * One table definition drives both dialects. Differences are handled here:
 *  - ids are TEXT holding UUIDv4 strings (generated in the app, so the same
 *    value can be linked to a Supabase `auth.users.id` when that provider is on);
 *  - booleans are INTEGER 0/1 in SQLite and BOOLEAN in Postgres;
 *  - timestamps are TEXT (ISO-8601) in SQLite and TIMESTAMPTZ in Postgres;
 *  - JSON payloads are TEXT in both dialects to keep the driver layer simple.
 *
 * The authoritative Postgres/Supabase schema with Row Level Security lives in
 * `supabase/migrations`. This module must stay in sync with it.
 */

export type ColType = 'text' | 'int' | 'bool' | 'ts' | 'json' | 'numeric';

export interface Col {
  name: string;
  type: ColType;
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  /** SQL literal for text/JSON defaults, or a boolean/number for typed ones. */
  default?: string | number | boolean;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
  index?: boolean;
}

export interface TableDef {
  name: string;
  columns: Col[];
}

export type Dialect = 'sqlite' | 'postgres';

/** Builds a quoted SQL string literal, e.g. d('NGN') -> 'NGN'. */
const d = (value: string): string => `'${value}'`;

export const uuid = (name = 'id') => ({
  name,
  type: 'text' as const,
  primaryKey: true,
  notNull: true,
});

export const createdAt = () => ({
  name: 'created_at',
  type: 'ts' as const,
  notNull: true,
});

export const updatedAt = () => ({
  name: 'updated_at',
  type: 'ts' as const,
  notNull: true,
});

function sqlType(type: ColType, dialect: Dialect): string {
  if (dialect === 'sqlite') {
    switch (type) {
      case 'int':
        return 'INTEGER';
      case 'bool':
        return 'INTEGER';
      case 'numeric':
        return 'NUMERIC';
      default:
        return 'TEXT';
    }
  }
  switch (type) {
    case 'int':
      return 'INTEGER';
    case 'bool':
      return 'BOOLEAN';
    case 'ts':
      return 'TIMESTAMPTZ';
    case 'numeric':
      return 'NUMERIC(14,2)';
    default:
      return 'TEXT';
  }
}

/**
 * Renders a column default for the target dialect.
 * Booleans are the main portability trap: SQLite needs 0/1, Postgres needs
 * TRUE/FALSE, so they are never written as raw strings in the table definitions.
 */
function defaultSql(col: Col, dialect: Dialect): string | null {
  if (col.default === undefined) return null;
  if (typeof col.default === 'boolean') {
    if (col.type !== 'bool') {
      throw new Error(
        `Column "${col.name}" has a boolean default but is not a bool column`,
      );
    }
    if (dialect === 'sqlite') return col.default ? '1' : '0';
    return col.default ? 'TRUE' : 'FALSE';
  }
  if (typeof col.default === 'number') return String(col.default);
  return col.default;
}

export function createTableSql(table: TableDef, dialect: Dialect): string {
  const parts: string[] = [];
  for (const col of table.columns) {
    let line = `  "${col.name}" ${sqlType(col.type, dialect)}`;
    if (col.primaryKey) line += ' PRIMARY KEY';
    if (col.notNull) line += ' NOT NULL';
    if (col.unique) line += ' UNIQUE';
    const dflt = defaultSql(col, dialect);
    if (dflt !== null) line += ` DEFAULT ${dflt}`;
    parts.push(line);
  }
  for (const col of table.columns) {
    if (!col.references) continue;
    const onDelete = col.references.onDelete ?? 'RESTRICT';
    parts.push(
      `  FOREIGN KEY ("${col.name}") REFERENCES "${col.references.table}"("${col.references.column}") ON DELETE ${onDelete}`,
    );
  }
  return `CREATE TABLE IF NOT EXISTS "${table.name}" (\n${parts.join(',\n')}\n);`;
}

export function createIndexSql(table: TableDef): string[] {
  const out: string[] = [];
  for (const col of table.columns) {
    if (!col.index || col.unique) continue;
    const name = `idx_${table.name}_${col.name}`;
    out.push(
      `CREATE INDEX IF NOT EXISTS "${name}" ON "${table.name}" ("${col.name}");`,
    );
  }
  return out;
}

/**
 * Table definitions.
 *
 * Ordering matters: a table may only reference a table declared before it,
 * because the migration runner creates tables sequentially.
 */
export const tables: TableDef[] = [
  {
    name: 'users',
    columns: [
      uuid(),
      { name: 'email', type: 'text', notNull: true, unique: true },
      { name: 'full_name', type: 'text', notNull: true },
      { name: 'password_hash', type: 'text' },
      { name: 'role', type: 'text', notNull: true, default: d('customer') },
      { name: 'phone', type: 'text' },
      { name: 'is_active', type: 'bool', notNull: true, default: true },
      { name: 'email_verified_at', type: 'ts' },
      { name: 'last_login_at', type: 'ts' },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'sessions',
    columns: [
      uuid(),
      {
        name: 'user_id',
        type: 'text',
        notNull: true,
        references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'token_hash', type: 'text', notNull: true, unique: true },
      { name: 'expires_at', type: 'ts', notNull: true, index: true },
      { name: 'user_agent', type: 'text' },
      { name: 'ip_address', type: 'text' },
      createdAt(),
    ],
  },
  {
    name: 'password_reset_tokens',
    columns: [
      uuid(),
      {
        name: 'user_id',
        type: 'text',
        notNull: true,
        references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'token_hash', type: 'text', notNull: true, unique: true },
      { name: 'expires_at', type: 'ts', notNull: true },
      { name: 'used_at', type: 'ts' },
      createdAt(),
    ],
  },
  {
    name: 'traveller_profiles',
    columns: [
      uuid(),
      {
        name: 'user_id',
        type: 'text',
        notNull: true,
        unique: true,
        references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
      },
      { name: 'preferences', type: 'json', notNull: true, default: d('{}') },
      { name: 'default_currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'home_city', type: 'text' },
      updatedAt(),
    ],
  },
  {
    name: 'conversations',
    columns: [
      uuid(),
      {
        name: 'user_id',
        type: 'text',
        references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'title', type: 'text', notNull: true, default: d('Trip planning') },
      { name: 'trip_profile', type: 'json', notNull: true, default: d('{}') },
      { name: 'status', type: 'text', notNull: true, default: d('active') },
      { name: 'last_message_at', type: 'ts' },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'messages',
    columns: [
      uuid(),
      {
        name: 'conversation_id',
        type: 'text',
        notNull: true,
        references: { table: 'conversations', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'role', type: 'text', notNull: true },
      { name: 'content', type: 'text', notNull: true },
      { name: 'meta', type: 'json', notNull: true, default: d('{}') },
      createdAt(),
    ],
  },
  {
    name: 'destinations',
    columns: [
      uuid(),
      { name: 'slug', type: 'text', notNull: true, unique: true },
      { name: 'name', type: 'text', notNull: true },
      { name: 'country', type: 'text', notNull: true, index: true },
      { name: 'region', type: 'text' },
      { name: 'destination_type', type: 'text', notNull: true, default: d('city') },
      { name: 'summary', type: 'text', notNull: true },
      { name: 'description', type: 'text' },
      { name: 'moods', type: 'json', notNull: true, default: d('[]') },
      { name: 'interests', type: 'json', notNull: true, default: d('[]') },
      { name: 'climate_tags', type: 'json', notNull: true, default: d('[]') },
      { name: 'duration_min_days', type: 'int', notNull: true, default: 2 },
      { name: 'duration_max_days', type: 'int', notNull: true, default: 7 },
      { name: 'cost_category', type: 'text', notNull: true, default: d('moderate') },
      { name: 'budget_min', type: 'numeric', notNull: true, default: 0 },
      { name: 'budget_max', type: 'numeric', notNull: true, default: 0 },
      { name: 'budget_currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'cost_components', type: 'json', notNull: true, default: d('{}') },
      { name: 'logistics', type: 'json', notNull: true, default: d('{}') },
      { name: 'seasonality', type: 'text' },
      { name: 'accessibility_notes', type: 'text' },
      { name: 'family_suitability', type: 'text' },
      { name: 'entry_requirements', type: 'json', notNull: true, default: d('{}') },
      { name: 'sources', type: 'json', notNull: true, default: d('[]') },
      { name: 'data_confidence', type: 'text', notNull: true, default: d('unverified') },
      { name: 'review_status', type: 'text', notNull: true, default: d('draft') },
      { name: 'is_published', type: 'bool', notNull: true, default: false, index: true },
      { name: 'last_checked_at', type: 'ts' },
      { name: 'created_by', type: 'text' },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'saved_trips',
    columns: [
      uuid(),
      {
        name: 'user_id',
        type: 'text',
        notNull: true,
        references: { table: 'users', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      {
        name: 'conversation_id',
        type: 'text',
        references: { table: 'conversations', column: 'id', onDelete: 'SET NULL' },
      },
      {
        name: 'destination_id',
        type: 'text',
        references: { table: 'destinations', column: 'id', onDelete: 'SET NULL' },
        index: true,
      },
      { name: 'title', type: 'text', notNull: true },
      { name: 'trip_profile', type: 'json', notNull: true, default: d('{}') },
      { name: 'budget_plan', type: 'json', notNull: true, default: d('{}') },
      { name: 'currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'status', type: 'text', notNull: true, default: d('draft') },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'itinerary_days',
    columns: [
      uuid(),
      {
        name: 'trip_id',
        type: 'text',
        notNull: true,
        references: { table: 'saved_trips', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'day_number', type: 'int', notNull: true },
      { name: 'title', type: 'text' },
      { name: 'notes', type: 'text' },
      { name: 'position', type: 'int', notNull: true, default: 0 },
      createdAt(),
    ],
  },
  {
    name: 'itinerary_activities',
    columns: [
      uuid(),
      {
        name: 'day_id',
        type: 'text',
        notNull: true,
        references: { table: 'itinerary_days', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      {
        name: 'trip_id',
        type: 'text',
        notNull: true,
        references: { table: 'saved_trips', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'time_label', type: 'text' },
      { name: 'title', type: 'text', notNull: true },
      { name: 'description', type: 'text' },
      { name: 'why_it_suits', type: 'text' },
      { name: 'duration_minutes', type: 'int' },
      { name: 'estimated_cost', type: 'numeric' },
      { name: 'currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'logistics', type: 'text' },
      { name: 'booking_note', type: 'text' },
      { name: 'source_url', type: 'text' },
      { name: 'position', type: 'int', notNull: true, default: 0 },
      createdAt(),
    ],
  },
  {
    name: 'enquiries',
    columns: [
      uuid(),
      { name: 'reference', type: 'text', notNull: true, unique: true },
      {
        name: 'user_id',
        type: 'text',
        references: { table: 'users', column: 'id', onDelete: 'SET NULL' },
        index: true,
      },
      { name: 'service', type: 'text', notNull: true, index: true },
      { name: 'contact_name', type: 'text', notNull: true },
      { name: 'contact_email', type: 'text', notNull: true },
      { name: 'contact_phone', type: 'text' },
      { name: 'party_size', type: 'int' },
      { name: 'departure_city', type: 'text' },
      { name: 'travel_start_date', type: 'text' },
      { name: 'flexibility', type: 'text' },
      { name: 'budget_amount', type: 'numeric' },
      { name: 'budget_currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'details', type: 'text', notNull: true },
      { name: 'status', type: 'text', notNull: true, default: d('NEW'), index: true },
      {
        name: 'owner_id',
        type: 'text',
        references: { table: 'users', column: 'id', onDelete: 'SET NULL' },
      },
      {
        name: 'destination_id',
        type: 'text',
        references: { table: 'destinations', column: 'id', onDelete: 'SET NULL' },
      },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'enquiry_events',
    columns: [
      uuid(),
      {
        name: 'enquiry_id',
        type: 'text',
        notNull: true,
        references: { table: 'enquiries', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'from_status', type: 'text' },
      { name: 'to_status', type: 'text', notNull: true },
      { name: 'note', type: 'text' },
      { name: 'actor_id', type: 'text' },
      { name: 'actor_label', type: 'text' },
      createdAt(),
    ],
  },
  {
    name: 'quotes',
    columns: [
      uuid(),
      { name: 'reference', type: 'text', notNull: true, unique: true },
      {
        name: 'enquiry_id',
        type: 'text',
        notNull: true,
        references: { table: 'enquiries', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      {
        name: 'user_id',
        type: 'text',
        references: { table: 'users', column: 'id', onDelete: 'SET NULL' },
        index: true,
      },
      { name: 'currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'subtotal', type: 'numeric', notNull: true, default: 0 },
      { name: 'fees', type: 'numeric', notNull: true, default: 0 },
      { name: 'total', type: 'numeric', notNull: true, default: 0 },
      { name: 'status', type: 'text', notNull: true, default: d('DRAFT'), index: true },
      { name: 'expires_at', type: 'ts' },
      { name: 'terms', type: 'text' },
      { name: 'notes', type: 'text' },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'quote_items',
    columns: [
      uuid(),
      {
        name: 'quote_id',
        type: 'text',
        notNull: true,
        references: { table: 'quotes', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'description', type: 'text', notNull: true },
      { name: 'quantity', type: 'numeric', notNull: true, default: 1 },
      { name: 'unit_price', type: 'numeric', notNull: true, default: 0 },
      { name: 'amount', type: 'numeric', notNull: true, default: 0 },
      { name: 'category', type: 'text' },
      { name: 'position', type: 'int', notNull: true, default: 0 },
      createdAt(),
    ],
  },
  {
    name: 'quote_events',
    columns: [
      uuid(),
      {
        name: 'quote_id',
        type: 'text',
        notNull: true,
        references: { table: 'quotes', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'event', type: 'text', notNull: true },
      { name: 'actor_id', type: 'text' },
      { name: 'note', type: 'text' },
      createdAt(),
    ],
  },
  {
    name: 'orders',
    columns: [
      uuid(),
      { name: 'reference', type: 'text', notNull: true, unique: true },
      {
        name: 'quote_id',
        type: 'text',
        references: { table: 'quotes', column: 'id', onDelete: 'SET NULL' },
        index: true,
      },
      {
        name: 'enquiry_id',
        type: 'text',
        references: { table: 'enquiries', column: 'id', onDelete: 'SET NULL' },
      },
      {
        name: 'user_id',
        type: 'text',
        references: { table: 'users', column: 'id', onDelete: 'SET NULL' },
        index: true,
      },
      { name: 'currency', type: 'text', notNull: true, default: d('NGN') },
      { name: 'subtotal', type: 'numeric', notNull: true, default: 0 },
      { name: 'fees', type: 'numeric', notNull: true, default: 0 },
      { name: 'total', type: 'numeric', notNull: true, default: 0 },
      { name: 'status', type: 'text', notNull: true, default: d('DRAFT'), index: true },
      {
        name: 'fulfilment_status',
        type: 'text',
        notNull: true,
        default: d('NOT_STARTED'),
      },
      { name: 'payable', type: 'bool', notNull: true, default: false },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'order_items',
    columns: [
      uuid(),
      {
        name: 'order_id',
        type: 'text',
        notNull: true,
        references: { table: 'orders', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      { name: 'description', type: 'text', notNull: true },
      { name: 'quantity', type: 'numeric', notNull: true, default: 1 },
      { name: 'unit_price', type: 'numeric', notNull: true, default: 0 },
      { name: 'amount', type: 'numeric', notNull: true, default: 0 },
      { name: 'category', type: 'text' },
      { name: 'position', type: 'int', notNull: true, default: 0 },
      createdAt(),
    ],
  },
  {
    name: 'payment_attempts',
    columns: [
      uuid(),
      {
        name: 'order_id',
        type: 'text',
        notNull: true,
        references: { table: 'orders', column: 'id', onDelete: 'CASCADE' },
        index: true,
      },
      {
        name: 'idempotency_key',
        type: 'text',
        notNull: true,
        unique: true,
      },
      { name: 'provider', type: 'text', notNull: true, default: d('paystack') },
      { name: 'provider_reference', type: 'text', index: true },
      { name: 'provider_access_code', type: 'text' },
      { name: 'amount', type: 'numeric', notNull: true },
      { name: 'currency', type: 'text', notNull: true },
      {
        name: 'status',
        type: 'text',
        notNull: true,
        default: d('INITIATED'),
        index: true,
      },
      { name: 'authorization_url', type: 'text' },
      { name: 'failure_reason', type: 'text' },
      { name: 'verified_at', type: 'ts' },
      { name: 'raw_summary', type: 'json', notNull: true, default: d('{}') },
      createdAt(),
      updatedAt(),
    ],
  },
  {
    name: 'payment_events',
    columns: [
      uuid(),
      { name: 'event_id', type: 'text', notNull: true, unique: true },
      { name: 'provider', type: 'text', notNull: true, default: d('paystack') },
      { name: 'provider_reference', type: 'text', index: true },
      { name: 'event_type', type: 'text', notNull: true },
      { name: 'status', type: 'text', notNull: true },
      { name: 'amount', type: 'numeric' },
      { name: 'currency', type: 'text' },
      { name: 'payload', type: 'json', notNull: true, default: d('{}') },
      { name: 'processed_at', type: 'ts' },
      createdAt(),
    ],
  },
  {
    name: 'audit_logs',
    columns: [
      uuid(),
      { name: 'actor_id', type: 'text' },
      { name: 'actor_label', type: 'text' },
      { name: 'action', type: 'text', notNull: true, index: true },
      { name: 'entity_type', type: 'text', notNull: true },
      { name: 'entity_id', type: 'text' },
      { name: 'meta', type: 'json', notNull: true, default: d('{}') },
      { name: 'ip_address', type: 'text' },
      createdAt(),
    ],
  },
  {
    name: 'notifications',
    columns: [
      uuid(),
      { name: 'channel', type: 'text', notNull: true },
      { name: 'recipient', type: 'text', notNull: true },
      { name: 'subject', type: 'text', notNull: true },
      { name: 'body', type: 'text', notNull: true },
      { name: 'status', type: 'text', notNull: true, default: d('PENDING'), index: true },
      { name: 'provider_reference', type: 'text' },
      { name: 'related_type', type: 'text' },
      { name: 'related_id', type: 'text' },
      { name: 'error', type: 'text' },
      createdAt(),
    ],
  },
  {
    name: 'ai_usage',
    columns: [
      uuid(),
      { name: 'kind', type: 'text', notNull: true, index: true },
      { name: 'provider', type: 'text', notNull: true },
      { name: 'model', type: 'text' },
      { name: 'status', type: 'text', notNull: true, index: true },
      { name: 'input_tokens', type: 'int' },
      { name: 'output_tokens', type: 'int' },
      { name: 'duration_ms', type: 'int' },
      { name: 'error_code', type: 'text' },
      { name: 'request_id', type: 'text' },
      createdAt(),
    ],
  },
];

export const schemaMigrationsTable = `CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "name" TEXT PRIMARY KEY,
  "applied_at" TEXT NOT NULL
);`;
