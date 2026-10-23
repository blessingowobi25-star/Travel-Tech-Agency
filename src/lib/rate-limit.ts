/**
 * Small in-memory rate limiter.
 *
 * MVP scale: a single instance is fine. For multi-instance deployments swap the
 * store for Redis (the interface is intentionally tiny).
 */
import { getEnv } from '@/config/env';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let envEnabled = true;
  try {
    envEnabled = getEnv().RATE_LIMIT_ENABLED;
  } catch {
    envEnabled = true;
  }
  if (!envEnabled) {
    return { allowed: true, remaining: limit, resetAt: now + windowMs, limit };
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs, limit };
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    limit,
  };
}

/** Best-effort client IP from proxy headers (first hop only). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}

/** Periodic cleanup so the map does not grow without bound. */
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }, 60_000);
  if (typeof timer.unref === 'function') timer.unref();
}
