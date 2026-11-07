import 'server-only';
import { z } from 'zod';
import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

// Lenient runtime schemas for the Steam Web API responses we consume. Steam's
// shapes are stable, but validating turns an unexpected payload into a clean
// empty/null result instead of letting `undefined` propagate into the DB.
// Parsing is per-entry so a single malformed game never drops the whole library.
const steamGameSchema = z.object({
  appid: z.number(),
  name: z.string(),
  playtime_forever: z.number().default(0),
  img_icon_url: z.string().default(''),
  playtime_2weeks: z.number().optional(),
  // Unix seconds; 0 when never played. Missing when game details are private.
  rtime_last_played: z.number().optional(),
});

const steamPlayerSummarySchema = z.object({
  steamid: z.string(),
  personaname: z.string(),
  profileurl: z.string().default(''),
  avatar: z.string().default(''),
  avatarmedium: z.string().default(''),
  avatarfull: z.string().default(''),
});

export type SteamGame = z.infer<typeof steamGameSchema>;

type SteamPlayerSummary = z.infer<typeof steamPlayerSummarySchema>;

export async function getOwnedGames(steamId: string, apiKey: string): Promise<SteamGame[]> {
  const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamid', steamId);
  url.searchParams.set('include_appinfo', 'true');
  url.searchParams.set('include_played_free_games', 'true');

  const response = await fetchWithTimeout(url.toString(), {}, TIMEOUTS.STEAM_API);

  if (!response.ok) {
    throw new Error(`Steam API error: ${response.status}`);
  }

  const data = await response.json();
  const rawGames = Array.isArray(data?.response?.games) ? data.response.games : [];

  // Validate per-entry: keep the well-formed games, drop anything malformed
  // rather than failing the whole import.
  const games: SteamGame[] = [];
  for (const raw of rawGames) {
    const parsed = steamGameSchema.safeParse(raw);
    if (parsed.success) games.push(parsed.data);
  }
  return games;
}

export async function getPlayerSummary(
  steamId: string,
  apiKey: string,
): Promise<SteamPlayerSummary | null> {
  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamids', steamId);

  const response = await fetchWithTimeout(url.toString(), {}, TIMEOUTS.STEAM_API);

  if (!response.ok) {
    throw new Error(`Steam API error: ${response.status}`);
  }

  const data = await response.json();
  const parsed = steamPlayerSummarySchema.safeParse(data?.response?.players?.[0]);
  return parsed.success ? parsed.data : null;
}
