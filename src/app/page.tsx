import Link from 'next/link';
import { brand } from '@/config/brand';

export default function Home() {
  return (
    <main className="min-h-screen bg-navy-900 text-ivory">
      <section className="py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Travel Tech Agency</h1>
        <p className="text-lg mb-12 max-w-2xl mx-auto">
          Curated travel experiences to Nigeria and beyond. Book your next adventure with us.
        </p>
        <div className="max-w-md mx-auto space-y-4">
          <Link href="/plan" className="btn-primary px-6 py-3 rounded-lg">
            Start planning your trip
          </Link>
          <Link href="/login" className="btn-outline px-6 py-3 rounded-lg">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}