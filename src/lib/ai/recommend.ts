import { getEnv } from '@/config/env';
import { logger } from '@/lib/logger';
import type { Destination } from '@/types/domain';
import {
  type ActivitySuggestion,
  type AiResult,
  type DayPlan,
  type ItineraryPlan,
  type RecommendedDestination,
  type TripProfile,
  aiStatus,
  callChatCompletion,
  extractJson,
} from './client';

/**
 * Destination recommendation.
 *
 * The rule-based engine scores destinations on mood, interest and budget fit.
 * It is deterministic and explainable, which makes it a usable default and a
 * sensible fallback when the AI provider is unavailable.
 */

function scoreDestination(destination: Destination, profile: TripProfile): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  const mood = profile.mood.trim().toLowerCase();
  if (mood && destination.moods.some((m) => m.toLowerCase() === mood)) {
    score += 40;
    reasons.push(`Matches the "${profile.mood}" mood`);
  }

  const matchedInterests = destination.interests.filter((interest) =>
    profile.interests.some((p) => p.trim().toLowerCase() === interest.toLowerCase()),
  );
  if (matchedInterests.length > 0) {
    score += Math.min(30, matchedInterests.length * 15);
    reasons.push(`Covers ${matchedInterests.join(', ')}`);
  }

  if (profile.budget > 0 && destination.budgetMax > 0) {
    if (profile.budget >= destination.budgetMin && profile.budget <= destination.budgetMax) {
      score += 25;
      reasons.push('Fits your budget');
    } else if (profile.budget > destination.budgetMax) {
      score += 8;
      reasons.push('Comfortably within your budget');
    } else {
      score -= 15;
      reasons.push('Costs more than your budget allows');
    }
  }

  if (
    profile.durationDays >= destination.durationMinDays &&
    profile.durationDays <= destination.durationMaxDays
  ) {
    score += 15;
    reasons.push(`Works well for a ${profile.durationDays}-day trip`);
  }

  return { score: Math.max(0, score), reasons };
}

export function recommendWithRules(
  destinations: Destination[],
  profile: TripProfile,
): RecommendedDestination[] {
  return destinations
    .map((destination) => {
      const { score, reasons } = scoreDestination(destination, profile);
      const estimatedBudget =
        profile.budget > 0
          ? Math.min(profile.budget, destination.budgetMax || profile.budget)
          : destination.budgetMin;
      return {
        slug: destination.slug,
        name: destination.name,
        country: destination.country,
        score,
        reasons,
        estimatedBudget,
        currency: profile.currency,
      };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const RECOMMEND_SYSTEM_PROMPT = `You are a Nigerian travel advisor.
Recommend destinations from the supplied list ONLY. Never invent a destination that is not in the list.
Return strict JSON: {"recommendations":[{"slug":"...","name":"...","country":"...","score":0-100,"reasons":["..."],"estimatedBudget":number}]}
Reasons must be concrete and reference the traveller's stated mood, interests, budget and trip length.`;

export async function recommendDestinations(
  destinations: Destination[],
  profile: TripProfile,
): Promise<AiResult<RecommendedDestination[]>> {
  const fallback = recommendWithRules(destinations, profile);
  const status = aiStatus();

  if (!status.configured) {
    return { data: fallback, provider: 'fallback', degraded: true, error: status.note };
  }

  const catalogue = destinations.map((d) => ({
    slug: d.slug,
    name: d.name,
    country: d.country,
    summary: d.summary,
    moods: d.moods,
    interests: d.interests,
    budgetMin: d.budgetMin,
    budgetMax: d.budgetMax,
    durationMinDays: d.durationMinDays,
    durationMaxDays: d.durationMaxDays,
    costCategory: d.costCategory,
  }));

  try {
    const { content } = await callChatCompletion(
      [
        { role: 'system', content: RECOMMEND_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Traveller profile:\n${JSON.stringify(profile)}\n\nDestinations:\n${JSON.stringify(catalogue)}\n\nRecommend up to 5.`,
        },
      ],
      { kind: 'recommend' },
    );

    const parsed = extractJson<{ recommendations?: RecommendedDestination[] }>(content);
    const aiList = parsed?.recommendations;
    if (!aiList || aiList.length === 0) {
      throw new Error('The AI response did not contain any recommendations.');
    }

    // Only keep slugs that actually exist, so the UI can always link to them.
    const valid = new Set(destinations.map((d) => d.slug));
    const safe = aiList
      .filter((r) => valid.has(r.slug))
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        country: r.country,
        score: Math.max(0, Math.min(100, Number(r.score) || 0)),
        reasons: Array.isArray(r.reasons) ? r.reasons.slice(0, 5) : [],
        estimatedBudget: Number(r.estimatedBudget) || 0,
        currency: profile.currency,
      }));

    if (safe.length === 0) throw new Error('The AI returned only unknown destinations.');

    return { data: safe, provider: 'openai', degraded: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('ai.recommend.failed', { error: message });
    return { data: fallback, provider: 'fallback', degraded: true, error: message };
  }
}
