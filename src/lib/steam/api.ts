import 'server-only';
import { z } from 'zod';
import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

// Validated so an unexpected payload gives an empty or null result instead of
// `undefined` reaching the database; per game, so one bad entry drops only itself.
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

export interface OwnedGames {
  games: SteamGame[];
  /**
   * No library at all, not an empty one: "Game details" aren't public (a public
   * library comes with a count, even of 0). Steam sometimes answers this way by
   * mistake; the next refresh puts it right.
   */
  isPrivate: boolean;
}

export async function getOwnedGames(steamId: string, apiKey: string): Promise<OwnedGames> {
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

  const games: SteamGame[] = [];
  for (const raw of rawGames) {
    const parsed = steamGameSchema.safeParse(raw);
    if (parsed.success) games.push(parsed.data);
  }
  const isPrivate = rawGames.length === 0 && typeof data?.response?.game_count !== 'number';
  return { games, isPrivate };
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
