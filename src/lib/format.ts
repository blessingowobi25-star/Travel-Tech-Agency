/**
 * Presentation helpers shared by the server-rendered pages.
 *
 * Keeping formatting in one place means a quote shown on the enquiry page and
 * the same quote shown on the order page always look identical.
 */

export function formatMoney(amount: number, currency = 'NGN'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('en-NG')}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-NG').format(Number.isFinite(value) ? value : 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human label for a status token such as `AWAITING_PAYMENT`. */
export function humanStatus(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Tailwind classes for a status badge, keyed by the token family. */
export function statusTone(value: string | null | undefined): string {
  switch ((value ?? '').toUpperCase()) {
    case 'PAID':
    case 'CONFIRMED':
    case 'SUCCESS':
    case 'COMPLETED':
      return 'bg-teal-100 text-teal-800';
    case 'AWAITING_PAYMENT':
    case 'PENDING':
    case 'INITIATED':
    case 'IN_REVIEW':
    case 'SENT':
      return 'bg-coral-100 text-coral-700';
    case 'NEW':
    case 'DRAFT':
      return 'bg-navy-100 text-navy-700';
    case 'CANCELLED':
    case 'CLOSED':
    case 'FAILED':
    case 'ABANDONED':
    case 'REJECTED':
    case 'EXPIRED':
      return 'bg-coral-100 text-coral-700';
    default:
      return 'bg-navy-100 text-navy-700';
  }
}

/** Turns a slug or free-text label into a readable title. */
export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Whitelist-based sanitiser for query-string text shown back to the user. */
export function safeText(value: string | null | undefined, max = 120): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}
