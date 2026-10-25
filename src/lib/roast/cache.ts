import { tryCreateServiceClient } from '@/lib/supabase/service';

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

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — roasts don't go stale

// Roasts are stored in the roast_cache table (service role only) so every
// serverless instance, the API routes and the server-rendered share page all
// see the same entries. The in-memory map is a fallback for when the service
// key or table isn't available, e.g. local development.

interface CachedRoast {
  response: RoastResponse;
  expiresAt: number;
}

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5_000;

const memoryCache = new Map<string, CachedRoast>();
let lastCleanupAt = 0;

function cleanupIfDue(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt < now) memoryCache.delete(key);
  }
}

function evictIfOverCapacity(): void {
  while (memoryCache.size > MAX_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) break;
    memoryCache.delete(oldestKey);
  }
}

function getFromMemory(steamId: string): RoastResponse | null {
  const now = Date.now();
  cleanupIfDue(now);
  const cached = memoryCache.get(steamId);
  return cached && cached.expiresAt > now ? cached.response : null;
}

export async function getCachedRoast(steamId: string): Promise<RoastResponse | null> {
  const client = tryCreateServiceClient();
  if (client) {
    const { data, error } = await client
      .from('roast_cache')
      .select('response')
      .eq('steam_id', steamId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<{ response: RoastResponse }>();
    if (!error) return data?.response ?? null;
    console.error('Roast cache read failed, using memory:', error);
  }
  return getFromMemory(steamId);
}

export async function setCachedRoast(steamId: string, response: RoastResponse): Promise<void> {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  memoryCache.set(steamId, { response, expiresAt });
  evictIfOverCapacity();

  const client = tryCreateServiceClient();
  if (!client) return;
  const { error } = await client
    .from('roast_cache')
    .upsert({ steam_id: steamId, response, expires_at: new Date(expiresAt).toISOString() });
  if (error) console.error('Roast cache write failed:', error);
}
