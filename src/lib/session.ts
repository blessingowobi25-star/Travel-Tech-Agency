import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  SESSION_COOKIE,
  resolveSession,
  type SessionUser,
} from '@/lib/auth/service';

/**
 * Session helpers for the server layer.
 *
 * The session token lives in an httpOnly cookie. Only the hash of the token is
 * stored in the database, so a database leak cannot be replayed as a login.
 */

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

/** Reads the current session user, or null when signed out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await resolveSession(token);
  return session?.user ?? null;
}

/** Requires a signed-in user; redirects to the login page otherwise. */
export async function requireUser(returnTo = '/dashboard'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}

/** Requires a staff account (agent or admin); redirects otherwise. */
export async function requireStaff(returnTo = '/dashboard'): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== 'admin' && user.role !== 'agent') {
    redirect('/dashboard?denied=staff');
  }
  return user;
}

/** Requires an admin account; redirects otherwise. */
export async function requireAdmin(returnTo = '/dashboard'): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== 'admin') {
    redirect('/dashboard?denied=admin');
  }
  return user;
}

/** Writes the session cookie. Only valid inside a Server Action or Route Handler. */
export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const store = await cookies();
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  store.set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge,
  });
}

/** Removes the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
