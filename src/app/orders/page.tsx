import { requireUser } from '@/lib/session';
import { listAttemptsForOrder } from '@/lib/payments/helpers';

export default async function OrdersPage({ params }: { params: { reference: string } }) {
  'use server';
  const user = await requireUser('/login');

  // Find order by reference - this would use the repository
  // For now, we'll show a placeholder
  const reference = params.reference;

  return (
    <main className="min-h-screen bg-navy-900 text-ivory p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Order #{reference}</h1>
        <p className="text-navy-400">Order reference: {reference}</p>
      </header>

      <div className="max-w-3xl mx-auto">
        <div className="bg-navy-800 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-bold">Order Details</h3>
          <p className="text-navy-400 placeholder">Order details will be displayed here.</p>
          <p className="mt-4 text-sm">Reference: {reference}</p>
        </div>

        {user.role === 'admin' ? (
          <div>
            <h4 className="text-semibold mb-4">Payment Attempts</h4>
            <p className="text-navy-400">Payment attempts for this order will be listed here.</p>
          </div>
        ) : (
          <div>
            <h4 className="text-semibold mb-4">View Payment History</h4>
            <p className="text-navy-400">Your payment history for this order.</p>
          </div>
        )}

        <div>
          <a href="/dashboard" className="btn-secondary mt-6">Back to dashboard</a>
        </div>
      </div>
    </main>
  );
}