/**
 * Domain types shared between the repository layer, services and the UI.
 *
 * These mirror the database shape but use real TypeScript types (numbers,
 * booleans, arrays) rather than the raw string columns, so callers never have
 * to think about dialect differences.
 */
import { parseJson } from '@/db/ids';

export type CostCategory = 'budget' | 'moderate' | 'premium' | 'luxury';

export interface Destination {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string | null;
  destinationType: string;
  summary: string;
  description: string | null;
  moods: string[];
  interests: string[];
  climateTags: string[];
  durationMinDays: number;
  durationMaxDays: number;
  costCategory: CostCategory;
  budgetMin: number;
  budgetMax: number;
  budgetCurrency: string;
  costComponents: Record<string, number>;
  logistics: Record<string, string>;
  seasonality: string | null;
  accessibilityNotes: string | null;
  familySuitability: string | null;
  entryRequirements: Record<string, unknown>;
  sources: string[];
  dataConfidence: string;
  reviewStatus: string;
  isPublished: boolean;
  lastCheckedAt: string | null;
}

export function mapDestination(row: Record<string, unknown>): Destination {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    country: String(row.country),
    region: row.region == null ? null : String(row.region),
    destinationType: String(row.destination_type ?? 'city'),
    summary: String(row.summary ?? ''),
    description: row.description == null ? null : String(row.description),
    moods: parseJson<string[]>(row.moods, []),
    interests: parseJson<string[]>(row.interests, []),
    climateTags: parseJson<string[]>(row.climate_tags, []),
    durationMinDays: Number(row.duration_min_days ?? 2),
    durationMaxDays: Number(row.duration_max_days ?? 7),
    costCategory: String(row.cost_category ?? 'moderate') as CostCategory,
    budgetMin: Number(row.budget_min ?? 0),
    budgetMax: Number(row.budget_max ?? 0),
    budgetCurrency: String(row.budget_currency ?? 'NGN'),
    costComponents: parseJson<Record<string, number>>(row.cost_components, {}),
    logistics: parseJson<Record<string, string>>(row.logistics, {}),
    seasonality: row.seasonality == null ? null : String(row.seasonality),
    accessibilityNotes:
      row.accessibility_notes == null ? null : String(row.accessibility_notes),
    familySuitability:
      row.family_suitability == null ? null : String(row.family_suitability),
    entryRequirements: parseJson<Record<string, unknown>>(row.entry_requirements, {}),
    sources: parseJson<string[]>(row.sources, []),
    dataConfidence: String(row.data_confidence ?? 'unverified'),
    reviewStatus: String(row.review_status ?? 'draft'),
    isPublished: row.is_published === 1 || row.is_published === true,
    lastCheckedAt: row.last_checked_at == null ? null : String(row.last_checked_at),
  };
}


export type EnquiryStatus =
  | 'NEW'
  | 'IN_REVIEW'
  | 'QUOTED'
  | 'CONFIRMED'
  | 'CLOSED';

export interface Enquiry {
  id: string;
  reference: string;
  userId: string | null;
  service: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  partySize: number | null;
  departureCity: string | null;
  travelStartDate: string | null;
  flexibility: string | null;
  budgetAmount: number | null;
  budgetCurrency: string;
  details: string;
  status: EnquiryStatus;
  ownerId: string | null;
  destinationId: string | null;
  createdAt: string;
}

export function mapEnquiry(row: Record<string, unknown>): Enquiry {
  return {
    id: String(row.id),
    reference: String(row.reference),
    userId: row.user_id == null ? null : String(row.user_id),
    service: String(row.service),
    contactName: String(row.contact_name),
    contactEmail: String(row.contact_email),
    contactPhone: row.contact_phone == null ? null : String(row.contact_phone),
    partySize: row.party_size == null ? null : Number(row.party_size),
    departureCity: row.departure_city == null ? null : String(row.departure_city),
    travelStartDate: row.travel_start_date == null ? null : String(row.travel_start_date),
    flexibility: row.flexibility == null ? null : String(row.flexibility),
    budgetAmount: row.budget_amount == null ? null : Number(row.budget_amount),
    budgetCurrency: String(row.budget_currency ?? 'NGN'),
    details: String(row.details ?? ''),
    status: String(row.status ?? 'NEW') as EnquiryStatus,
    ownerId: row.owner_id == null ? null : String(row.owner_id),
    destinationId: row.destination_id == null ? null : String(row.destination_id),
    createdAt: String(row.created_at),
  };
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface QuoteItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: string | null;
  position: number;
}

export interface Quote {
  id: string;
  reference: string;
  enquiryId: string;
  userId: string | null;
  currency: string;
  subtotal: number;
  fees: number;
  total: number;
  status: QuoteStatus;
  expiresAt: string | null;
  terms: string | null;
  notes: string | null;
  items: QuoteItem[];
  createdAt: string;
}


export type OrderStatus = 'DRAFT' | 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED';

export interface Order {
  id: string;
  reference: string;
  quoteId: string | null;
  enquiryId: string | null;
  userId: string | null;
  currency: string;
  subtotal: number;
  fees: number;
  total: number;
  status: OrderStatus;
  fulfilmentStatus: string;
  payable: boolean;
  items: QuoteItem[];
  createdAt: string;
}

export function mapOrder(row: Record<string, unknown>, items: QuoteItem[] = []): Order {
  return {
    id: String(row.id),
    reference: String(row.reference),
    quoteId: row.quote_id == null ? null : String(row.quote_id),
    enquiryId: row.enquiry_id == null ? null : String(row.enquiry_id),
    userId: row.user_id == null ? null : String(row.user_id),
    currency: String(row.currency ?? 'NGN'),
    subtotal: Number(row.subtotal ?? 0),
    fees: Number(row.fees ?? 0),
    total: Number(row.total ?? 0),
    status: String(row.status ?? 'DRAFT') as OrderStatus,
    fulfilmentStatus: String(row.fulfilment_status ?? 'NOT_STARTED'),
    payable: row.payable === 1 || row.payable === true,
    items,
    createdAt: String(row.created_at),
  };
}

export interface ItineraryActivity {
  id: string;
  dayId: string;
  tripId: string;
  timeLabel: string | null;
  title: string;
  description: string | null;
  whyItSuits: string | null;
  durationMinutes: number | null;
  estimatedCost: number | null;
  currency: string;
  logistics: string | null;
  bookingNote: string | null;
  position: number;
}

export interface ItineraryDay {
  id: string;
  tripId: string;
  dayNumber: number;
  title: string | null;
  notes: string | null;
  position: number;
  activities: ItineraryActivity[];
}

export interface SavedTrip {
  id: string;
  userId: string;
  conversationId: string | null;
  destinationId: string | null;
  title: string;
  tripProfile: Record<string, unknown>;
  budgetPlan: Record<string, unknown>;
  currency: string;
  status: string;
  days: ItineraryDay[];
  createdAt: string;
}

export function mapQuote(row: Record<string, unknown>, items: QuoteItem[] = []): Quote {
  return {
    id: String(row.id),
    reference: String(row.reference),
    enquiryId: String(row.enquiry_id),
    userId: row.user_id == null ? null : String(row.user_id),
    currency: String(row.currency ?? 'NGN'),
    subtotal: Number(row.subtotal ?? 0),
    fees: Number(row.fees ?? 0),
    total: Number(row.total ?? 0),
    status: String(row.status ?? 'DRAFT') as QuoteStatus,
    expiresAt: row.expires_at == null ? null : String(row.expires_at),
    terms: row.terms == null ? null : String(row.terms),
    notes: row.notes == null ? null : String(row.notes),
    items,
    createdAt: String(row.created_at),
  };
}
