interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);
cleanupInterval.unref();

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
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
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

  // Fallbacks for non-Vercel environments (local dev, tests)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

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
  // 3 roasts per hour per IP (public, uses OpenAI)
  roast: { limit: 3, windowMs: 60 * 60 * 1000 },
  // Global circuit breaker: cap fresh roast generations across all users per day.
  // Bounds worst-case OpenAI spend if the per-IP limit is distributed across many IPs.
  roastGlobal: { limit: 100, windowMs: 24 * 60 * 60 * 1000 },
} as const;
