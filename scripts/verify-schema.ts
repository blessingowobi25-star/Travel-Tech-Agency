import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';

const file = '.data/waymark.db';
rmSync(file, { force: true });

// Rebuild from scratch through the real migration path.
const { migrate } = await import('../src/db/migrate');
const { resetDb } = await import('../src/db/client');
const result = await migrate();
await resetDb();

const db = new DatabaseSync(file);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as { name: string }[];
const indexes = db
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
  .all() as { name: string }[];

console.log('tables:', tables.length);
console.log('indexes:', indexes.length);

// Every table must have an id PK and the expected columns.
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all() as {
    name: string;
    pk: number;
    notnull: number;
  }[];
  const pk = cols.find((c) => c.pk === 1);
  if (!pk || pk.name !== 'id') console.log('!! missing id PK:', t.name);
}

let fkTotal = 0;
for (const t of tables) {
  const fks = db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all() as unknown[];
  fkTotal += fks.length;
}
console.log('foreign keys:', fkTotal);

const violations = db.prepare('PRAGMA foreign_key_check').all();
console.log('fk violations:', violations.length);

// Spot-check defaults actually applied.
const destCols = db.prepare('PRAGMA table_info("destinations")').all() as {
  name: string;
  dflt_value: string | null;
}[];
console.log(
  'destinations.is_published default:',
  destCols.find((c) => c.name === 'is_published')?.dflt_value,
);
console.log(
  'destinations.moods default:',
  destCols.find((c) => c.name === 'moods')?.dflt_value,
);

// Insert a user and a dependent row to prove FKs enforce.
db.exec(
  `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
   VALUES ('u1','a@b.ng','Test','customer',1,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
);
db.exec(
  `INSERT INTO traveller_profiles (id, user_id, preferences, default_currency, updated_at)
   VALUES ('p1','u1','{}','NGN','2026-01-01T00:00:00.000Z')`,
);
try {
  db.exec(
    `INSERT INTO traveller_profiles (id, user_id, preferences, default_currency, updated_at)
     VALUES ('p2','nope','{}','NGN','2026-01-01T00:00:00.000Z')`,
  );
  console.log('!! FK violation NOT enforced');
} catch (e) {
  console.log('FK enforced:', (e as Error).message.slice(0, 60));
}

db.close();
console.log('OK');
