import Link from 'next/link';
import { brand } from '@/config/brand';
import { getCurrentUser } from '@/lib/session';
import { SESSION_COOKIE } from '@/lib/auth/service';

const NAV_LINKS = [
  { href: '/destinations', label: 'Destinations' },
  { href: '/plan', label: 'Trip planner' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
] as const;

/** Public site header. Shows account state when a session exists. */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-ivory/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 font-display text-lg font-bold text-ivory"
          >
            W
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold text-navy-900">
              {brand.name}
            </span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-navy-400 sm:block">
              {brand.launchCity}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-600 transition hover:text-navy-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="btn-secondary px-4 py-2 text-xs">
                Dashboard
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="btn-primary px-4 py-2 text-xs">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary px-4 py-2 text-xs">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2 text-xs">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Sign-out is a server action so the session cookie can be cleared. */
async function logoutAction() {
  'use server';
  const { destroySession } = await import('@/lib/auth/service');
  const { clearSessionCookie } = await import('@/lib/session');
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  const { redirect } = await import('next/navigation');
  redirect('/');
}
