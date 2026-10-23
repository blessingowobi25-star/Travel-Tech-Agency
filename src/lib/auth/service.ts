import { getEnv } from '@/config/env';
import { logger } from '@/lib/logger';
import { boolParam, one, run } from '@/db/client';
import { fromDbBool, newId, nowIso } from '@/db/ids';
import { hashPassword, hashToken, newSessionToken, verifyPassword } from './password';

export type Role = 'customer' | 'agent' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
}

export interface Session {
  token: string;
  user: SessionUser;
  expiresAt: string;
}

export const SESSION_COOKIE = 'waymark_session';

const ROLE_SET = new Set<string>(['customer', 'agent', 'admin']);

function toRole(value: unknown): Role {
  const role = String(value ?? 'customer');
  return ROLE_SET.has(role) ? (role as Role) : 'customer';
}

function mapUser(row: Record<string, unknown>): SessionUser {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: toRole(row.role),
    isActive: fromDbBool(row.is_active),
  };
}

/** Normalises an email address for storage and lookup. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<SessionUser | null> {
  const row = await one(
    'SELECT id, email, full_name, role, is_active FROM users WHERE email = ?',
    [normaliseEmail(email)],
  );
  return row ? mapUser(row) : null;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: Role;
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const email = normaliseEmail(input.email);
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('An account with that email already exists.');

  const id = newId();
  const now = nowIso();
  const passwordHash = await hashPassword(input.password);

  await run(
    `INSERT INTO users (id, email, full_name, password_hash, role, phone, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      email,
      input.fullName.trim(),
      passwordHash,
      input.role ?? 'customer',
      input.phone?.trim() ?? null,
      await boolParam(true),
      now,
      now,
    ],
  );

  logger.info('auth.user.registered', { userId: id, role: input.role ?? 'customer' });
  return {
    id,
    email,
    fullName: input.fullName.trim(),
    role: input.role ?? 'customer',
    isActive: true,
  };
}


export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const row = await one<Record<string, unknown>>(
    'SELECT id, email, full_name, role, is_active, password_hash FROM users WHERE email = ?',
    [normaliseEmail(email)],
  );
  if (!row) {
    // Spend comparable time so a missing account is not distinguishable by timing.
    await verifyPassword(password, 'scrypt$16384$8$1$00$00');
    return null;
  }
  const ok = await verifyPassword(password, String(row.password_hash ?? ''));
  if (!ok) return null;
  if (!fromDbBool(row.is_active)) return null;

  await run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [
    nowIso(),
    nowIso(),
    String(row.id),
  ]);

  return mapUser(row);
}

/** Issues a session and returns the raw token (only the hash is persisted). */
export async function createSession(
  userId: string,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<Session> {
  const env = getEnv();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600_000).toISOString();

  await run(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      userId,
      hashToken(token),
      expiresAt,
      meta.userAgent ?? null,
      meta.ipAddress ?? null,
      nowIso(),
    ],
  );

  const user = await getUserById(userId);
  if (!user) throw new Error('Cannot create a session for a missing user.');
  return { token, expiresAt, user };
}

export async function getUserById(id: string): Promise<SessionUser | null> {
  const row = await one(
    'SELECT id, email, full_name, role, is_active FROM users WHERE id = ?',
    [id],
  );
  return row ? mapUser(row) : null;
}

/** Resolves a raw session token to a live session, or null if absent/expired. */
export async function resolveSession(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) return null;
  const row = await one<Record<string, unknown>>(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.full_name, u.role, u.is_active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    [hashToken(token)],
  );
  if (!row) return null;

  const expiresAt = String(row.expires_at);
  if (new Date(expiresAt).getTime() <= Date.now()) {
    await run('DELETE FROM sessions WHERE id = ?', [String(row.session_id)]);
    return null;
  }
  if (!fromDbBool(row.is_active)) return null;

  return { token, expiresAt, user: mapUser(row) };
}

export async function destroySession(token: string): Promise<void> {
  await run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

/** Removes expired sessions. Called opportunistically. */
export async function pruneSessions(): Promise<number> {
  const result = await run('DELETE FROM sessions WHERE expires_at <= ?', [nowIso()]);
  return result.rowCount;
}

/**
 * Administrative role check.
 *
 * `ADMIN_EMAILS` grants admin to the listed addresses even if the stored role
 * says otherwise, which keeps the MVP operable without a database edit.
 */
export function isAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getEnv().ADMIN_EMAIL_LIST.includes(user.email.toLowerCase());
}

export function isStaff(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'agent' || isAdmin(user);
}
