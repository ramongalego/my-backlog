export interface RoastResponse {
  roast: string;
  steamId: string;
  profile: {
    name: string;
    avatar: string;
    profileUrl: string;
  };
  stats: {
    totalGames: number;
    totalHours: number;
    neverPlayed: number;
  };
}

interface CachedRoast {
  response: RoastResponse;
  expiresAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — roasts don't go stale
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5_000;

const roastCache = new Map<string, CachedRoast>();
let lastCleanupAt = 0;

function cleanupIfDue(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, entry] of roastCache) {
    if (entry.expiresAt < now) roastCache.delete(key);
  }
}

function evictIfOverCapacity(): void {
  while (roastCache.size > MAX_ENTRIES) {
    const oldestKey = roastCache.keys().next().value;
    if (oldestKey === undefined) break;
    roastCache.delete(oldestKey);
  }
}

export function getCachedRoast(steamId: string): RoastResponse | null {
  const now = Date.now();
  cleanupIfDue(now);
  const cached = roastCache.get(steamId);
  if (cached && cached.expiresAt > now) return cached.response;
  return null;
}

export function setCachedRoast(steamId: string, response: RoastResponse): void {
  roastCache.set(steamId, { response, expiresAt: Date.now() + CACHE_TTL_MS });
  evictIfOverCapacity();
}
