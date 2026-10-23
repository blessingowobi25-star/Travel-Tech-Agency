'use server';

export async function loginAction(email: string, password: string) {
  const { authenticate } = await import('@/lib/auth/service');
  const user = await authenticate(email, password);
  if (!user) {
    return { success: false, error: 'Invalid email or password.' };
  }
  const { createSession } = await import('@/lib/auth/service');
  const session = await createSession(user.id);
  const { setSessionCookie } = await import('@/lib/session');
  await setSessionCookie(session.token, session.expiresAt);
  return { success: true, user: session.user };
}

export async function registerAction(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
  role?: 'customer' | 'agent' | 'admin'
) {
  'use server';
  try {
    const { registerUser } = await import('@/lib/auth/service');
    const user = await registerUser({ email, password, fullName, phone, role });
    const { createSession } = await import('@/lib/auth/service');
    const session = await createSession(user.id);
    const { setSessionCookie } = await import('@/lib/session');
    await setSessionCookie(session.token, session.expiresAt);
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Registration failed.' };
  }
}

export async function logoutAction() {
  'use server';
  const { destroySession } = await import('@/lib/auth/service');
  const { clearSessionCookie } = await import('@/lib/session');
  const { cookies } = await import('next/headers');
  const store = await cookies();
  const token = store.get('waymark_session')?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  const { redirect } = await import('next/navigation');
  redirect('/');
}