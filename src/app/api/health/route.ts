import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUser();
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      user: user ? { id: user.id, role: user.role } : null,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}