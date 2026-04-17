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
  // 10 roasts per hour per IP (public, uses OpenAI)
  roast: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Global circuit breaker: cap fresh roast generations across all users per day.
  // Bounds worst-case OpenAI spend if the per-IP limit is distributed across many IPs.
  roastGlobal: { limit: 500, windowMs: 24 * 60 * 60 * 1000 },
} as const;
