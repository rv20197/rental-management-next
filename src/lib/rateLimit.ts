import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;
if (!redis) {
  logger.warn('UPSTASH_REDIS_REST_URL/TOKEN not set — auth rate limiting disabled');
}

type Window =
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

// Singletons. Per-name prefix keeps each route's counters in its own bucket.
const cache = new Map<string, Ratelimit>();

export function createLimiter(name: string, requests: number, window: Window): Ratelimit | null {
  if (!redis) return null;
  const cached = cache.get(name);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `rl:${name}`,
    analytics: false,
  });
  cache.set(name, limiter);
  return limiter;
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

// Returns a 429 Response when the IP is over the limit; null otherwise.
// Returns null when the limiter is disabled so dev keeps working without
// Upstash creds.
export async function enforceLimit(
  limiter: Ratelimit | null,
  ip: string,
): Promise<Response | null> {
  if (!limiter) return null;
  const { success, limit, remaining, reset } = await limiter.limit(ip);
  if (success) return null;
  return Response.json(
    { message: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(reset),
        'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
      },
    },
  );
}
