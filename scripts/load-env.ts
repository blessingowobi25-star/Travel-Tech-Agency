import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env loader for the CLI scripts (Next.js loads .env itself).
 * Parses KEY=value, ignores comments and blank lines, strips quotes.
 */
export function loadEnvFile(file = '.env') {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
