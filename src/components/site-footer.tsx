import Link from 'next/link';
import { brand, serviceCatalog } from '@/config/brand';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-navy-100 bg-navy-900 text-navy-100">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl font-semibold text-ivory">{brand.name}</p>
          <p className="mt-3 text-sm leading-relaxed text-navy-200">{brand.tagline}</p>
          <p className="mt-4 text-sm text-navy-300">{brand.description}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-300">
            Services
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {serviceCatalog.slice(0, 6).map((service) => (
              <li key={service.key}>
                <Link
                  href={`/enquire?service=${service.key}`}
                  className="text-navy-100 transition hover:text-ivory"
                >
                  {service.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-300">
            Explore
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/destinations" className="text-navy-100 transition hover:text-ivory">
                Destination catalogue
              </Link>
            </li>
            <li>
              <Link href="/plan" className="text-navy-100 transition hover:text-ivory">
                AI trip planner
              </Link>
            </li>
            <li>
              <Link href="/enquire" className="text-navy-100 transition hover:text-ivory">
                Request a quote
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-navy-100 transition hover:text-ivory">
                Sign in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-navy-300">
            Contact
          </p>
          <ul className="mt-4 space-y-2 text-sm text-navy-100">
            <li>{brand.contact.address}</li>
            <li>
              <a href={`mailto:${brand.contact.email}`} className="hover:text-ivory">
                {brand.contact.email}
              </a>
            </li>
            <li>
              <a
                href={`tel:${brand.contact.phone.replace(/\s+/g, '')}`}
                className="hover:text-ivory"
              >
                {brand.contact.phone}
              </a>
            </li>
            <li>{brand.contact.hours}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-navy-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
          </p>
          <p>
            Estimates are planning guidance, not confirmed bookings. Prices are
            verified before you pay.
          </p>
        </div>
      </div>
    </footer>
  );
}
