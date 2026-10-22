import { requireUser, requireStaff } from '@/lib/session';

export default async function Dashboard() {
  'use server';
  const user = await requireUser('/login');
  const staff = await requireStaff('/dashboard?denied=staff');

  return (
    <main className="min-h-screen bg-navy-900 text-ivory p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-navy-400">Welcome, {user.fullName}</p>
      </header>

      {user.role === 'admin' ? (
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-navy-800 rounded-lg p-6">
            <h3 className="text-xl font-bold">Total Orders</h3>
            <p className="text-3xl">128</p>
          </div>
          <div className="bg-navy-800 rounded-lg p-6">
            <h3 className="text-xl font-bold">Total Revenue</h3>
            <p className="text-3xl">₦2,457,300</p>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <h3 className="text-xl font-bold">My Orders</h3>
          <p className="text-navy-400">Your order history will appear here.</p>
        </div>
      )}

      <nav>
        <ul className="grid grid-cols-2 gap-4">
          <li>
            <a href="/plan" className="text-navy-400 hover:text-navy-200">Trip planner</a>
          </li>
          <li>
            <a href="/orders" className="text-navy-400 hover:text-navy-200">My orders</a>
          </li>
        </ul>
      </nav>
    </main>
  );
}