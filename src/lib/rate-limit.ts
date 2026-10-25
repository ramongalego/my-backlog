import { tryCreateServiceClient } from '@/lib/supabase/service';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Bound the in-memory store so a burst of unique identifiers can't grow it
// without limit. On overflow we evict the oldest entry (Map preserves insertion
// order). This is a soft cap — still imperfect for serverless, but keeps a
// single instance from leaking unbounded memory.
const MAX_ENTRIES = 10_000;
// Cleanup runs at most this often to amortize its cost across requests.
const CLEANUP_INTERVAL_MS = 60_000;

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

function cleanupIfDue(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}

function evictIfOverCapacity(): void {
  while (rateLimitStore.size > MAX_ENTRIES) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitStore.delete(oldestKey);
  }
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  cleanupIfDue(now);

  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    evictIfOverCapacity();
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt,
    };
  }

  entry.count++;

  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate-limit key for an IP. IPv6 users are typically assigned a whole /64, so
 * keying on the full address would let one client rotate through endless keys.
 */
export function ipRateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const address = ip.split('%')[0]; // drop any zone id
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is really an IPv4 client.
  if (address.includes('.')) return address.slice(address.lastIndexOf(':') + 1);

  // Expand "::" so the first four groups really are the /64 prefix.
  const [head, tail] = address.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? headGroups
      : [
          ...headGroups,
          ...Array(Math.max(0, 8 - headGroups.length - tailGroups.length)).fill('0'),
          ...tailGroups,
        ];
  const prefix = groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''));
  return `${prefix.join(':')}::/64`;
}

/**
 * Like checkRateLimit, but counted in Postgres (consume_rate_limit) so the
 * limit holds across serverless instances and cold starts. Falls back to the
 * in-memory limiter if the service key or the function isn't available.
 */
export async function checkSharedRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const client = tryCreateServiceClient();
  if (client) {
    const { data, error } = await client
      .rpc('consume_rate_limit', {
        p_key: identifier,
        p_limit: config.limit,
        p_window_seconds: Math.ceil(config.windowMs / 1000),
      })
      .single<{ allowed: boolean; remaining: number; reset_at: string }>();
    if (!error && data) {
      return {
        success: data.allowed,
        limit: config.limit,
        remaining: data.remaining,
        resetAt: new Date(data.reset_at).getTime(),
      };
    }
    warnSharedLimiterOnce(error);
  }
  return checkRateLimit(identifier, config);
}

let warnedSharedLimiter = false;
function warnSharedLimiterOnce(error: unknown) {
  if (warnedSharedLimiter) return;
  warnedSharedLimiter = true;
  console.error('Shared rate limiter unavailable, using in-memory fallback:', error);
}

export function getClientIp(request: Request): string {
  // On Vercel, this header is set server-side and cannot be spoofed by clients.
  // Prefer it over x-forwarded-for, which is client-controllable.
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

// Pre-configured rate limiters
export const RATE_LIMITS = {
  // 60 requests per minute for game status updates
  gameStatus: { limit: 60, windowMs: 60 * 1000 },
  // 500 requests per minute for sync operations (per user) — scoped per user so no abuse concern
  gameSync: { limit: 500, windowMs: 60 * 1000 },
  // 10 bulk sync requests per minute (each resolves hundreds of games from cache)
  gameSyncBulk: { limit: 10, windowMs: 60 * 1000 },
  // 10 requests per hour for Steam refresh
  steamRefresh: { limit: 10, windowMs: 60 * 60 * 1000 },
  // 20 requests per minute for AI suggestions (accounts for rerolls)
  suggestion: { limit: 20, windowMs: 60 * 1000 },
  // 60 profile lookups per hour per IP. Resolving a vanity name spends the
  // shared Steam API key quota, so it's limited before any Steam call.
  roastLookup: { limit: 60, windowMs: 60 * 60 * 1000 },
  // 10 roasts per hour per IP (public, uses OpenAI)
  roast: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Global circuit breaker: cap fresh roast generations across all users per day.
  // Bounds worst-case OpenAI spend if the per-IP limit is distributed across many IPs.
  roastGlobal: { limit: 500, windowMs: 24 * 60 * 60 * 1000 },
} as const;
