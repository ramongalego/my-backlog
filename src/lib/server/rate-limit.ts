import 'server-only';
import { tryCreateServiceClient } from '@/lib/supabase/service';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// So a burst of unique identifiers can't grow the store without limit. The
// oldest entry goes first (a Map keeps insertion order).
const MAX_ENTRIES = 10_000;
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
 * Counted in Postgres so the limit holds across serverless instances; in memory
 * without the service key or the function. `failClosed` refuses instead in
 * production, for budgets that cap spending: a per-instance count would
 * multiply the budget by the number of instances.
 */
export async function checkSharedRateLimit(
  identifier: string,
  config: RateLimitConfig,
  { failClosed = false }: { failClosed?: boolean } = {},
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
  if (failClosed && process.env.NODE_ENV === 'production') {
    console.error(`Shared rate limiter unavailable; refusing ${identifier}`);
    return { success: false, limit: config.limit, remaining: 0, resetAt: Date.now() + 60_000 };
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
  // Set by Vercel, so a client can't spoof it, unlike x-forwarded-for.
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

export const RATE_LIMITS = {
  gameStatus: { limit: 60, windowMs: 60 * 1000 },
  // One request for the lot, and one more for an Undo.
  gameStatusBulk: { limit: 20, windowMs: 60 * 1000 },
  // Per user. A first import asks for every game the shared cache lacks, eight
  // at a time, so this is well above that.
  gameSync: { limit: 500, windowMs: 60 * 1000 },
  // Each resolves hundreds of games from cache.
  gameSyncBulk: { limit: 10, windowMs: 60 * 1000 },
  // Up to 5 games per request.
  gameSyncHltb: { limit: 60, windowMs: 60 * 1000 },
  // Debounced, so a few per title.
  gameSearch: { limit: 60, windowMs: 60 * 1000 },
  // Each one looks up IGDB and HowLongToBeat.
  gameAdd: { limit: 30, windowMs: 60 * 1000 },
  // Each opening asks SteamGridDB with the app's key; saving a pick counts too.
  gameArt: { limit: 30, windowMs: 60 * 1000 },
  // Every drag-reorder is a request, so this only stops scripts.
  queueWrite: { limit: 300, windowMs: 60 * 1000 },
  // A handful of presses at most.
  profileWrite: { limit: 60, windowMs: 60 * 1000 },
  // Each try checks the current password: this stops guessing it at an
  // unlocked computer.
  accountPassword: { limit: 5, windowMs: 15 * 60 * 1000 },
  // Each try says whether a username is taken: a few tries find a free one,
  // and this stops a script from listing them or taking them in turn.
  usernameChange: { limit: 20, windowMs: 60 * 60 * 1000 },
  // Per IP: profile pages (/u/<username>), which anyone can open. Far more
  // than reading them takes, prefetches included; it only stops a script.
  profileView: { limit: 120, windowMs: 60 * 1000 },
  // Each one is stored.
  avatarUpload: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Each one sends confirmation emails.
  accountEmail: { limit: 5, windowMs: 60 * 60 * 1000 },
  // Each one reads the whole library.
  accountExport: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Each makes this server contact Steam. Every press of Connect Steam counts,
  // finished or not (Back from Steam's page, a second try).
  steamLink: { limit: 30, windowMs: 60 * 60 * 1000 },
  steamRefresh: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Generous for real use, tight enough to stop spam.
  support: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Public share pages for finished games.
  share: { limit: 30, windowMs: 60 * 60 * 1000 },
  // Per IP. Crawlers fetch it once per link and the CDN caches it for a month,
  // so this only stops rendering in a loop.
  shareImage: { limit: 60, windowMs: 60 * 1000 },
  // Allows for rerolls.
  suggestion: { limit: 20, windowMs: 60 * 1000 },
  // Per user, so free accounts can't be scripted into a big OpenAI bill.
  suggestionDaily: { limit: 100, windowMs: 24 * 60 * 60 * 1000 },
  // Each comes with a suggestion request, which has its own, tighter limit.
  suggestionReroll: { limit: 60, windowMs: 60 * 1000 },
  // game_picks rows. A roll takes a couple of seconds, so this only stops
  // scripts filling the table.
  pickRecord: { limit: 60, windowMs: 60 * 1000 },
  // Caps the day's OpenAI spend however many accounts are used.
  suggestionGlobal: { limit: 3000, windowMs: 24 * 60 * 60 * 1000 },
  // OpenAI. Each is saved and only written again when the library changes.
  insights: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  // Global circuit breaker on player profiles, like suggestionGlobal.
  insightsGlobal: { limit: 1000, windowMs: 24 * 60 * 60 * 1000 },
} as const;
