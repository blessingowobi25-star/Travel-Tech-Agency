import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number },
) => Promise<Buffer>;

/**
 * Password hashing for the built-in local auth provider.
 *
 * Uses scrypt with a per-password random salt. The stored format is
 * `scrypt$N$r$p$saltHex$hashHex` so the parameters can be raised later without
 * invalidating existing hashes.
 *
 * When Supabase Auth is enabled this module is not used at all - see
 * `src/lib/auth/index.ts` for the provider switch.
 */
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
  });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
    });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Opaque session token handed to the browser. Only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes a session token for storage.
 * A plain SHA-256 digest is appropriate here: the token is already a
 * 256-bit random value, so there is nothing to brute-force - the digest
 * simply means a database leak does not hand over live sessions.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
