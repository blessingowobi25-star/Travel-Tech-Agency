/**
 * Structured server-side logging with redaction of secrets and sensitive data.
 *
 * Everything is written as one JSON object per line so it can be shipped to any
 * free-tier log collector later without changing the call sites.
 */
import { getEnv } from '@/config/env';

const SECRET_KEYS = [
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'card',
  'cvv',
  'passport',
  'secretkey',
  'session_token',
  'reference',
];

const REDACTED = '[redacted]';

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase().replace(/[-\s]/g, '');
      if (SECRET_KEYS.some((s) => key.includes(s.replace(/[-_\s]/g, '')))) {
        out[k] = REDACTED;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level: Level): boolean {
  try {
    const env = getEnv();
    return ORDER[level] >= ORDER[env.LOG_LEVEL];
  } catch {
    return true;
  }
}

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};

/** Generates a short correlation id used to tie a request together in logs. */
export function requestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
