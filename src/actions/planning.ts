'use server';

import { recommendWithRules } from '@/lib/ai/recommend';
import { generateItinerary } from '@/lib/ai/itinerary';

export async function getRecommendationsAction(budget: number, interests: string[], climateTags?: string[]) {
  'use server';
  const destinations: any[] = [];
  const profile: any = { budget, interests, climateTags };
  const recommendations = await recommendWithRules(destinations, profile);
  return { success: true, recommendations };
}

export async function generateItineraryAction(destination: string, duration: number, budget: number) {
  'use server';
  const dest: any = { name: destination, budgetMin: 0, budgetMax: budget, durationMinDays: duration, durationMaxDays: duration };
  const profile: any = { budget, duration, interests: [], moods: [], climateTags: climateTags || [] };
  const itinerary = await generateItinerary(dest, profile);
  return { success: true, itinerary };
}