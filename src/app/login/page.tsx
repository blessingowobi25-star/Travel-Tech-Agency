import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-ivory p-8">
      <div className="max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6">Sign in</h2>
        <form className="space-y-4" onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const form = new FormData(e.target as HTMLFormElement);
          const result = await loginAction(
            form.get('email') as string,
            form.get('password') as string
          );
          if (!result.success) {
            alert(result.error);
          } else {
            window.location.href = '/dashboard';
          }
        }}>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" name="email" required className="w-full rounded-border border-input bg-input px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input type="password" name="password" required className="w-full rounded-border border-input bg-input px-3 py-2" />
          </div>
          <button type="submit" className="btn-primary w-full">Sign in</button>
        </form>
        <p className="text-center text-sm mt-6">
          Don't have an account? <Link href="/register">Create account</Link>
        </p>
      </div>
    </main>
  );
}