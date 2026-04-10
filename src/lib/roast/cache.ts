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

const roastCache = new Map<string, CachedRoast>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — roasts don't go stale

// Clean up expired entries every 10 minutes
const cleanupInterval = setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of roastCache) {
      if (entry.expiresAt < now) roastCache.delete(key);
    }
  },
  10 * 60 * 1000,
);
cleanupInterval.unref();

export function getCachedRoast(steamId: string): RoastResponse | null {
  const cached = roastCache.get(steamId);
  if (cached && cached.expiresAt > Date.now()) return cached.response;
  return null;
}

export function setCachedRoast(steamId: string, response: RoastResponse): void {
  roastCache.set(steamId, { response, expiresAt: Date.now() + CACHE_TTL });
}
