/**
 * Central, single-place brand + business configuration.
 *
 * The brand name is provisional ("Waymark Travel") until the founder supplies
 * the approved name. Changing it here updates the UI, emails and documents.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Waymark Travel',
  legalName: process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME ?? 'Waymark Travel',
  tagline: 'Plan it with us. Travel with confidence.',
  description:
    'AI-assisted trip planning and human travel services for Nigerian travellers. ' +
    'Tell us how you want to feel; we help you find where to go, build a realistic budget ' +
    'and take the bookings off your plate.',
  launchCity: 'Abuja',
  market: 'Nigeria',
  /** Placeholder contact details - replace before launch. */
  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@waymarktravel.example',
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '+234 800 000 0000',
    whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '2348000000000',
    address: 'Abuja, Nigeria',
    hours: 'Monday - Friday, 9:00 - 18:00 WAT',
  },
  /** Service fee shown on quotes. These are business decisions - change them here. */
  fees: {
    /** Flat planning/coordination fee in NGN applied to quote service lines. */
    serviceFeeNgn: Number(process.env.SERVICE_FEE_NGN ?? 25000),
    /** Percentage of order subtotal charged as platform fee (e.g. 0.05 = 5%). */
    platformFeeRate: Number(process.env.PLATFORM_FEE_RATE ?? 0.05),
    /** Default contingency allowance percentage added to budget estimates. */
    contingencyRate: Number(process.env.CONTINGENCY_RATE ?? 0.1),
  },
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? '',
    x: process.env.NEXT_PUBLIC_X ?? '',
  },
} as const;

/** Service catalogue for the travel-services enquiry workflow. */
export const serviceCatalog = [
  {
    key: 'flight_assistance',
    label: 'Flight booking assistance',
    blurb: 'We search options, explain the trade-offs and handle the booking steps with you.',
  },
  {
    key: 'accommodation_package',
    label: 'Accommodation & holiday packages',
    blurb: 'Hotels, lodges and packaged stays sized to your budget and comfort level.',
  },
  {
    key: 'visa_assistance',
    label: 'Visa & document readiness',
    blurb: 'We help you assemble and sanity-check documents. We cannot guarantee approvals.',
  },
  {
    key: 'airport_transfer',
    label: 'Airport transfers',
    blurb: 'Pre-arranged pickup and drop-off for departures and arrivals.',
  },
  {
    key: 'group_travel',
    label: 'Group travel',
    blurb: 'Coordinated trips for families, friends, church groups and teams.',
  },
  {
    key: 'corporate_travel',
    label: 'Corporate travel support',
    blurb: 'Repeatable travel handling for company teams and offsite planning.',
  },
  {
    key: 'custom_itinerary',
    label: 'Custom itinerary planning',
    blurb: 'A human planner turns your saved AI itinerary into a detailed, workable plan.',
  },
] as const;

export type ServiceKey = (typeof serviceCatalog)[number]['key'];

export function getService(key: string) {
  return serviceCatalog.find((s) => s.key === key);
}

export const whatsappMessage = (reference?: string) =>
  reference
    ? `Hello Waymark Travel, I would like to follow up on enquiry ${reference}.`
    : 'Hello Waymark Travel, I would like to plan a trip. Could we talk?';
