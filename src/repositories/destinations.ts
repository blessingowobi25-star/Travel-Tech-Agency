import { boolLiteral, boolParam, many, one, run } from '@/db/client';
import { newId, nowIso } from '@/db/ids';
import { type Destination, mapDestination } from '@/types/domain';

export interface DestinationFilters {
  /** Free-text search across name, summary and region. */
  search?: string;
  country?: string;
  mood?: string;
  interest?: string;
  costCategory?: string;
  maxBudget?: number;
  maxDuration?: number;
  /** Staff-only: include unpublished rows. */
  includeUnpublished?: boolean;
  limit?: number;
  offset?: number;
}

const DESTINATION_COLUMNS = `
  id, slug, name, country, region, destination_type, summary, description,
  moods, interests, climate_tags, duration_min_days, duration_max_days,
  cost_category, budget_min, budget_max, budget_currency, cost_components,
  logistics, seasonality, accessibility_notes, family_suitability,
  entry_requirements, sources, data_confidence, review_status, is_published,
  last_checked_at
`;

/**
 * Lists destinations with filtering.
 *
 * Filtering on JSON columns (moods, interests) matches the raw JSON text,
 * which works on both dialects without needing JSON extension support. The
 * comparison is intentionally loose (`LIKE '%"value"%'`) because the data is
 * small and stored as a JSON array of strings.
 */
export async function listDestinations(
  filters: DestinationFilters = {},
): Promise<Destination[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (!filters.includeUnpublished) {
    where.push(`is_published = ${await boolLiteral(true)}`);
  }

  if (filters.search) {
    where.push('(LOWER(name) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(region) LIKE ?)');
    const term = `%${filters.search.toLowerCase()}%`;
    params.push(term, term, term);
  }
  if (filters.country) {
    where.push('LOWER(country) = ?');
    params.push(filters.country.toLowerCase());
  }
  if (filters.mood) {
    where.push('LOWER(moods) LIKE ?');
    params.push(`%"${filters.mood.toLowerCase()}"%`);
  }
  if (filters.interest) {
    where.push('LOWER(interests) LIKE ?');
    params.push(`%"${filters.interest.toLowerCase()}"%`);
  }
  if (filters.costCategory) {
    where.push('cost_category = ?');
    params.push(filters.costCategory);
  }
  if (typeof filters.maxBudget === 'number') {
    where.push('budget_max <= ?');
    params.push(filters.maxBudget);
  }
  if (typeof filters.maxDuration === 'number') {
    where.push('duration_max_days <= ?');
    params.push(filters.maxDuration);
  }

  const sql = `SELECT ${DESTINATION_COLUMNS} FROM destinations
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY is_published DESC, name ASC
    LIMIT ? OFFSET ?`;
  params.push(filters.limit ?? 100, filters.offset ?? 0);

  const rows = await many<Record<string, unknown>>(sql, params);
  return rows.map(mapDestination);
}

export async function getDestinationById(id: string): Promise<Destination | null> {
  const row = await one(
    `SELECT ${DESTINATION_COLUMNS} FROM destinations WHERE id = ?`,
    [id],
  );

  return row ? mapDestination(row) : null;
}
export interface UpsertDestinationInput {
  slug: string;
  name: string;
  country: string;
  region?: string | null;
  destinationType?: string;
  summary: string;
  description?: string | null;
  moods?: string[];
  interests?: string[];
  climateTags?: string[];
  durationMinDays?: number;
  durationMaxDays?: number;
  costCategory?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetCurrency?: string;
  costComponents?: Record<string, number>;
  logistics?: Record<string, string>;
  seasonality?: string | null;
  accessibilityNotes?: string | null;
  familySuitability?: string | null;
  entryRequirements?: Record<string, unknown>;
  sources?: string[];
  dataConfidence?: string;
  reviewStatus?: string;
  isPublished?: boolean;
}

/**
 * Inserts or updates a destination keyed on slug.
 *
 * Used by the seed script so it can be run repeatedly without creating
 * duplicates.
 */
export async function upsertDestination(
  input: UpsertDestinationInput,
): Promise<Destination> {
  const now = nowIso();
  const existing = await getDestinationBySlug(input.slug);

  const values: Record<string, string | number | boolean | null> = {
    name: input.name,
    country: input.country,
    region: input.region ?? null,
    destination_type: input.destinationType ?? 'city',
    summary: input.summary,
    description: input.description ?? null,
    moods: JSON.stringify(input.moods ?? []),
    interests: JSON.stringify(input.interests ?? []),
    climate_tags: JSON.stringify(input.climateTags ?? []),
    duration_min_days: input.durationMinDays ?? 2,
    duration_max_days: input.durationMaxDays ?? 7,
    cost_category: input.costCategory ?? 'moderate',
    budget_min: input.budgetMin ?? 0,
    budget_max: input.budgetMax ?? 0,
    budget_currency: input.budgetCurrency ?? 'NGN',
    cost_components: JSON.stringify(input.costComponents ?? {}),
    logistics: JSON.stringify(input.logistics ?? {}),
    seasonality: input.seasonality ?? null,
    accessibility_notes: input.accessibilityNotes ?? null,
    family_suitability: input.familySuitability ?? null,
    entry_requirements: JSON.stringify(input.entryRequirements ?? {}),
    sources: JSON.stringify(input.sources ?? []),
    data_confidence: input.dataConfidence ?? 'unverified',
    review_status: input.reviewStatus ?? 'draft',
    is_published: await boolParam(input.isPublished ?? false),
  };

  if (existing) {
    const sets = Object.keys(values)
      .map((k) => `${k} = ?`)
      .join(', ');
    await run(
      `UPDATE destinations SET ${sets}, updated_at = ? WHERE id = ?`,
      [...Object.values(values), now, existing.id],
    );
    return (await getDestinationById(existing.id)) as Destination;
  }

  const id = newId();
  const cols = ['id', 'slug', ...Object.keys(values), 'created_at', 'updated_at'];
  const params = [id, input.slug, ...Object.values(values), now, now];
  await run(
    `INSERT INTO destinations (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params,
  );
  return (await getDestinationById(id)) as Destination;
}

/** Distinct values used to populate the discovery filter UI. */
export async function destinationFacets(): Promise<{
  countries: string[];
  moods: string[];
  interests: string[];
  costCategories: string[];
}> {
  const rows = await many<Record<string, unknown>>(
    `SELECT country, moods, interests, cost_category FROM destinations
     WHERE is_published = ${await boolLiteral(true)}`,
  );

  const countries = new Set<string>();
  const moods = new Set<string>();
  const interests = new Set<string>();
  const costCategories = new Set<string>();

  for (const row of rows) {
    countries.add(String(row.country));
    costCategories.add(String(row.cost_category));
    for (const m of JSON.parse(String(row.moods ?? '[]'))) moods.add(String(m));
    for (const i of JSON.parse(String(row.interests ?? '[]'))) interests.add(String(i));
  }

  return {
    countries: [...countries].sort(),
    moods: [...moods].sort(),
    interests: [...interests].sort(),
    costCategories: [...costCategories].sort(),
  };
}


export async function getDestinationBySlug(slug: string): Promise<Destination | null> {
  const row = await one(
    `SELECT ${DESTINATION_COLUMNS} FROM destinations WHERE slug = ?`,
    [slug],
  );
  return row ? mapDestination(row) : null;
}
