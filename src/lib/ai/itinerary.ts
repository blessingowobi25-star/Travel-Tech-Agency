import { logger } from '@/lib/logger';
import type { Destination } from '@/types/domain';
import {
  type ActivitySuggestion,
  type AiResult,
  type DayPlan,
  type ItineraryPlan,
  type TripProfile,
  aiStatus,
  callChatCompletion,
  extractJson,
} from './client';

/**
 * Itinerary generation.
 *
 * The rule-based engine builds a realistic day-by-day plan from the
 * destination's own metadata (interests, logistics, seasonality, cost
 * components). It does not invent attractions it has no record of - it
 * arranges the destination's known interests into a sensible day structure and
 * labels the output as a starting point rather than a confirmed booking.
 */

interface ActivityTemplate {
  title: string;
  description: string;
  whyItSuits: string;
  timeLabel: string;
  durationMinutes: number;
  logistics: string;
  costShare: number;
}

const DAY_OPENERS: ActivityTemplate[] = [
  {
    title: 'Settle in and orient yourself',
    description:
      'Arrive, drop your bags and walk the main commercial area to get your bearings.',
    whyItSuits: 'Keeps the first day light so you are not exhausted on arrival.',
    timeLabel: 'Morning',
    durationMinutes: 120,
    logistics: 'Local transport from your accommodation',
    costShare: 0.05,
  },
  {
    title: 'Local food experience',
    description:
      'Eat something regional and cooked close to where it is produced. Ask one dish question - the answer is usually better than a review.',
    whyItSuits: 'Food is the fastest way to understand a place and rarely over budget.',
    timeLabel: 'Lunch',
    durationMinutes: 120,
    logistics: 'Street vendors or a local restaurant',
    costShare: 0.12,
  },
];

const EVENING_ACTIVITY: ActivityTemplate = {
  title: 'Golden-hour viewpoint and dinner',
  description:
    'Catch the light from a known vantage point, then have dinner nearby so you are not travelling far when you are tired.',
  whyItSuits: 'Packs the best of the evening into one short trip out.',
  timeLabel: 'Evening',
  durationMinutes: 180,
  logistics: 'Walk or a short ride',
  costShare: 0.1,
};

const INTEREST_ACTIVITY: Record<string, ActivityTemplate> = {
  history: {
    title: 'Heritage walk',
    description:
      'Follow the historic core on foot, with time for a guide who can explain what you are looking at.',
    whyItSuits: 'Matches your interest in history.',
    timeLabel: 'Morning',
    durationMinutes: 180,
    logistics: 'Local guide recommended',
    costShare: 0.1,
  },
  wildlife: {
    title: 'Nature and wildlife outing',
    description:
      'Spend the day in the closest protected area, leaving early to beat the heat.',
    whyItSuits: 'Matches your interest in wildlife.',
    timeLabel: 'Full day',
    durationMinutes: 420,
    logistics: 'Book a vehicle or join a group tour',
    costShare: 0.25,
  },
  beach: {
    title: 'Beach morning',
    description:
      'Head to the coast early, before the midday sun, and stay for a swim and a long lunch.',
    whyItSuits: 'Matches your interest in the beach.',
    timeLabel: 'Morning',
    durationMinutes: 300,
    logistics: 'Transport to the coastline',
    costShare: 0.12,
  },
  nightlife: {
    title: 'Nightlife evening',
    description:
      'A relaxed night out - live music or a sports bar rather than a club, unless that is specifically your scene.',
    whyItSuits: 'Matches your interest in nightlife.',
    timeLabel: 'Evening',
    durationMinutes: 240,
    logistics: 'Taxi or ride-hailing back',
    costShare: 0.15,
  },
  food: {
    title: 'Market and cooking session',
    description:
      'Shop at the market and learn to cook one dish yourself. You eat better and you understand the ingredients.',
    whyItSuits: 'Matches your interest in food.',
    timeLabel: 'Late morning',
    durationMinutes: 240,
    logistics: 'Market visit then a cooking class',
    costShare: 0.18,
  },
  culture: {
    title: 'Art and craft centre',
    description:
      'Visit a local craft centre and talk to the makers. Buy directly and the money stays in the community.',
    whyItSuits: 'Matches your interest in culture and craft.',
    timeLabel: 'Afternoon',
    durationMinutes: 180,
    logistics: 'Taxi or bus',
    costShare: 0.1,
  },
  adventure: {
    title: 'Outdoor adventure morning',
    description:
      'A guided outdoor activity - a short hike, a boat trip or a longer drive out into the surrounding area.',
    whyItSuits: 'Matches your interest in adventure.',
    timeLabel: 'Early morning',
    durationMinutes: 360,
    logistics: 'Book with a local operator',
    costShare: 0.22,
  },
  photography: {
    title: 'Golden-hour photography walk',
    description:
      'A slow walk focused on light and detail, with a guide who knows the quieter corners.',
    whyItSuits: 'Matches your interest in photography.',
    timeLabel: 'Late afternoon',
    durationMinutes: 180,
    logistics: 'Walking, comfortable shoes',
    costShare: 0.12,
  },
};

/** Picks the activity templates that best match the traveller's interests. */
function templateForInterests(interests: string[]): ActivityTemplate[] {
  const matched: ActivityTemplate[] = [];
  const lowered = interests.map((i) => i.toLowerCase());

  for (const [key, template] of Object.entries(INTEREST_ACTIVITY)) {
    if (lowered.some((i) => i.includes(key) || key.includes(i))) matched.push(template);
  }
  return matched;
}


function toActivity(
  template: ActivityTemplate,
  baseDaily: number,
  why: string,
): ActivitySuggestion {
  const cost = Math.round(baseDaily * template.costShare);
  return {
    timeLabel: template.timeLabel,
    title: template.title,
    description: template.description,
    whyItSuits: `${template.whyItSuits} ${why}`,
    durationMinutes: template.durationMinutes,
    estimatedCost: cost,
    logistics: template.logistics,
  };
}

export function buildItineraryWithRules(
  destination: Destination,
  profile: TripProfile,
): ItineraryPlan {
  const dayCount = Math.max(1, Math.min(profile.durationDays, 14));
  const matched = templateForInterests(profile.interests);
  const baseDaily = Math.max(8000, (destination.budgetMax || 60000) / Math.max(dayCount, 1));

  const days: DayPlan[] = [];
  for (let day = 1; day <= dayCount; day += 1) {
    const activities: ActivitySuggestion[] = [];

    // Day 1 is always the light arrival day.
    if (day === 1) {
      activities.push(
        toActivity(DAY_OPENERS[0], baseDaily, 'You have just arrived.'),
        toActivity(DAY_OPENERS[1], baseDaily, 'Your first full meal here.'),
      );
    } else {
      const template = matched.length > 0 ? matched[(day - 2) % matched.length] : null;
      if (template) {
        activities.push(toActivity(template, baseDaily, `Day ${day} highlight.`));
      } else {
        activities.push(
          toActivity(
            {
              title: `Explore ${destination.name}`,
              description: `A flexible day around ${destination.name}'s main sights.`,
              whyItSuits: 'A day to follow your own pace.',
              timeLabel: 'Morning',
              durationMinutes: 300,
              logistics: 'Local transport',
              costShare: 0.15,
            },
            baseDaily,
            'No specific interests given, so this day stays flexible.',
          ),
        );
      }
    }

    activities.push(toActivity(EVENING_ACTIVITY, baseDaily, 'Wind down.'));

    days.push({
      dayNumber: day,
      title: day === 1 ? `Arrival in ${destination.name}` : `${destination.name}, day ${day}`,
      notes:
        day === 1
          ? 'Keep the first day light. You are also jet-lagged if you crossed a time zone.'
          : 'Times are suggestions. Shift them if the weather or your energy says otherwise.',
      activities,
    });
  }

  const activityTotal = days.reduce(
    (sum, d) => sum + d.activities.reduce((s, a) => s + a.estimatedCost, 0),
    0,
  );
  const travellers = Math.max(1, profile.travellers ?? 1);
  const activitiesTotal = Math.round(activityTotal * travellers);
  const accommodation = Math.round(activitiesTotal * 0.3);
  const transport = Math.round(activitiesTotal * 0.15);
  const total = activitiesTotal + accommodation + transport;

  return {
    destinationSlug: destination.slug,
    destinationName: destination.name,
    title: `${dayCount}-day ${destination.name} plan`,
    summary: `A ${dayCount}-day plan for ${destination.name} built around ${
      profile.interests.length > 0 ? profile.interests.join(', ') : 'general sightseeing'
    }. Costs are per ${travellers} traveller${travellers > 1 ? 's' : ''} in ${profile.currency}.`,
    days,
    budgetPlan: {
      currency: profile.currency,
      total,
      perPerson: Math.round(total / travellers),
      breakdown: {
        activities: activitiesTotal,
        accommodation,
        transport,
      },

    },
    caveats: [
      'Costs are estimates built from typical prices, not quotes. Confirm before you pay anything.',
      'Opening hours and last-entry times change - check them on the day.',
      'We cannot guarantee visa approvals or that a place will be open when you arrive.',
    ],
  };
}



const ITINERARY_SYSTEM_PROMPT = `You are a Nigerian travel planner writing a realistic day-by-day itinerary.
Return strict JSON:
{"title":"...","summary":"...","days":[{"dayNumber":1,"title":"...","notes":"...","activities":[{"timeLabel":"Morning","title":"...","description":"...","whyItSuits":"...","durationMinutes":120,"estimatedCost":5000,"logistics":"..."}]}],"caveats":["..."]}
Use only the destination provided. Keep costs realistic for Nigeria (NGN). Do not promise visa approvals.`;

export async function generateItinerary(
  destination: Destination,
  profile: TripProfile,
): Promise<AiResult<ItineraryPlan>> {
  const fallback = buildItineraryWithRules(destination, profile);
  const status = aiStatus();

  if (!status.configured) {
    return { data: fallback, provider: 'fallback', degraded: true, error: status.note };
  }

  try {
    const { content } = await callChatCompletion(
      [
        { role: 'system', content: ITINERARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Destination:\n${JSON.stringify({
            name: destination.name,
            country: destination.country,
            summary: destination.summary,
            description: destination.description,
            interests: destination.interests,
            climateTags: destination.climateTags,
            seasonality: destination.seasonality,
            logistics: destination.logistics,
            budgetMin: destination.budgetMin,
            budgetMax: destination.budgetMax,
          })}\n\nTraveller:\n${JSON.stringify(profile)}\n\nBuild the plan for ${Math.min(profile.durationDays, 14)} days.`,
        },
      ],
      { kind: 'itinerary' },
    );

    const parsed = extractJson<{
      title?: string;
      summary?: string;
      days?: DayPlan[];
      caveats?: string[];
    }>(content);

    if (!parsed?.days?.length) {
      throw new Error('The AI response did not contain a usable itinerary.');
    }

    const days = parsed.days.slice(0, 14).map((day, index) => ({
      dayNumber: Number(day.dayNumber) || index + 1,
      title: String(day.title ?? `Day ${index + 1}`),
      notes: String(day.notes ?? ''),
      activities: (day.activities ?? []).map((activity) => ({
        timeLabel: String(activity.timeLabel ?? 'Morning'),
        title: String(activity.title ?? 'Activity'),
        description: String(activity.description ?? ''),
        whyItSuits: String(activity.whyItSuits ?? ''),
        durationMinutes: Number(activity.durationMinutes) || 120,
        estimatedCost: Number(activity.estimatedCost) || 0,
        logistics: String(activity.logistics ?? ''),
      })),
    }));

    const travellers = Math.max(1, profile.travellers ?? 1);
    const activitySum = days.reduce(
      (sum, day) => sum + day.activities.reduce((s, a) => s + a.estimatedCost, 0),
      0,
    );
    const activitiesTotal = Math.round(activitySum * travellers);
    const total = Math.round(activitiesTotal * 1.45); // activities + stay + transport

    const plan: ItineraryPlan = {
      destinationSlug: destination.slug,
      destinationName: destination.name,
      title: String(parsed.title ?? `${days.length}-day ${destination.name} plan`),
      summary: String(parsed.summary ?? fallback.summary),
      days,
      budgetPlan: {
        currency: profile.currency,
        total,
        perPerson: Math.round(total / travellers),
        breakdown: {
          activities: activitiesTotal,
          accommodation: Math.round(total * 0.3),
          transport: Math.round(total * 0.15),
        },
      },
      caveats: parsed.caveats?.length ? parsed.caveats : fallback.caveats,
    };

    return { data: plan, provider: 'openai', degraded: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('ai.itinerary.failed', { error: message });
    return { data: fallback, provider: 'fallback', degraded: true, error: message };
  }
}
