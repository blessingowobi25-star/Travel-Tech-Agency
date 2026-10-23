import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-ivory p-8">
      <div className="max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-6">Create account</h2>
        <form className="space-y-4" onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const form = new FormData(e.target as HTMLFormElement);
          const result = await registerAction(
            form.get('email') as string,
            form.get('password') as string,
            form.get('fullName') as string,
            form.get('phone') as string,
          );
          if (!result.success) {
            alert(result.error);
          } else {
            window.location.href = '/dashboard';
          }
        }}>
          <div>
            <label className="block text-sm font-medium mb-2">Full name</label>
            <input type="text" name="fullName" required className="w-full rounded-border border-input bg-input px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" name="email" required className="w-full rounded-border border-input bg-input px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <input type="tel" name="phone" className="w-full rounded-border border-input bg-input px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input type="password" name="password" required className="w-full rounded-border border-input bg-input px-3 py-2" />
          </div>
          <button type="submit" className="btn-primary w-full">Create account</button>
        </form>
        <p className="text-center text-sm mt-6">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}