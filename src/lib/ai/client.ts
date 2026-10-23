import { getEnv } from '@/config/env';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

/**
 * AI adapter for trip recommendations and itinerary generation.
 *
 * Two providers:
 *  - `openai`: any OpenAI-compatible chat-completions endpoint (OpenAI, Groq,
 *    OpenRouter). Used when AI_API_KEY is set.
 *  - `fallback`: a deterministic, clearly-labelled rule-based engine that runs
 *    with zero credentials. It is NOT an LLM and the UI says so.
 *
 * The fallback exists so the product is usable and testable on day one without
 * an AI account, and so that a provider outage degrades instead of breaking
 * the request path.
 */

export interface TripProfile {
  mood: string;
  interests: string[];
  durationDays: number;
  budget: number;
  currency: string;
  departureCity?: string;
  travellers?: number;
}

export interface RecommendedDestination {
  slug: string;
  name: string;
  country: string;
  score: number;
  reasons: string[];
  estimatedBudget: number;
  currency: string;
}

export interface ActivitySuggestion {
  timeLabel: string;
  title: string;
  description: string;
  whyItSuits: string;
  durationMinutes: number;
  estimatedCost: number;
  logistics: string;
}

export interface DayPlan {
  dayNumber: number;
  title: string;
  notes: string;
  activities: ActivitySuggestion[];
}

export interface ItineraryPlan {
  destinationSlug: string;
  destinationName: string;
  title: string;
  summary: string;
  days: DayPlan[];
  budgetPlan: {
    currency: string;
    total: number;
    perPerson: number;
    breakdown: Record<string, number>;
  };
  caveats: string[];
}

export interface AiResult<T> {
  data: T;
  /** Which provider actually produced this. */
  provider: 'openai' | 'fallback';
  /** True when the requested provider failed and the fallback was used. */
  degraded: boolean;
  /** Set when the provider was called but errored. */
  error?: string;
}

export interface AiCallOptions {
  kind: string;
  /** Distinguishes parallel calls so the rate limiter does not punish them. */
  bucket?: string;
}

/**
 * Checks that the AI provider is usable and reports why if it is not.
 * Used by /api/health so the founder can see the real state of the app.
 */
export function aiStatus(): { configured: boolean; provider: string; note: string } {
  const env = getEnv();
  if (env.AI_PROVIDER === 'fallback') {
    return {
      configured: true,
      provider: 'fallback',
      note: 'Rule-based development engine (not an LLM). Set AI_PROVIDER=openai and AI_API_KEY for real AI.',
    };
  }
  if (!env.AI_API_KEY) {
    return {
      configured: false,
      provider: 'openai',
      note: 'AI_PROVIDER=openai but AI_API_KEY is missing. Recommendations fall back to the rule-based engine.',
    };
  }
  return {
    configured: true,
    provider: 'openai',
    note: `Connected to ${env.AI_BASE_URL} (${env.AI_MODEL}).`,
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callChatCompletion(
  messages: ChatMessage[],
  options: AiCallOptions,
): Promise<{ content: string; inputTokens?: number; outputTokens?: number }> {
  const env = getEnv();
  const bucket = options.bucket ?? options.kind;

  const limit = rateLimit(`ai:${bucket}`, env.AI_REQUESTS_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    throw new Error('AI request rate limit reached. Please try again shortly.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: env.AI_MAX_OUTPUT_TOKENS,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI provider returned ${response.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider returned an empty response.');

    return {
      content,
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts the first JSON object or array from a model response. */
export function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    /* fall through to the brace-scan approach */
  }

  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const opener = candidate[start];
  const closer = opener === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === opener) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export { logger };
