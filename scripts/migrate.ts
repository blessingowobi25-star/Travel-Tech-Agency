import { loadEnvFile } from './load-env';
import { migrate } from '../src/db/migrate';
import { resetDb } from '../src/db/client';

loadEnvFile();

async function main() {
  console.log('Applying schema...');
  const result = await migrate();
  console.log(`Done. Dialect: ${result.dialect}. Tables: ${result.applied.length}`);
  await resetDb();
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
