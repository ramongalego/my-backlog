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

export type SteamPlayerSummary = z.infer<typeof steamPlayerSummarySchema>;

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

export async function resolveVanityURL(vanityName: string, apiKey: string): Promise<string | null> {
  const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('vanityurl', vanityName);

  const response = await fetchWithTimeout(url.toString(), {}, TIMEOUTS.STEAM_API);
  if (!response.ok) return null;

  const data = await response.json();
  return data.response?.success === 1 ? data.response.steamid : null;
}

/**
 * Parse a Steam input (URL, profile ID, or vanity name) into a Steam ID.
 * Supported formats:
 *  - https://steamcommunity.com/profiles/76561198012345678
 *  - https://steamcommunity.com/id/username
 *  - 76561198012345678
 *  - username
 */
export async function parseSteamInput(input: string, apiKey: string): Promise<string | null> {
  const trimmed = input.trim();

  // Direct Steam ID (17-digit number)
  if (/^\d{17}$/.test(trimmed)) return trimmed;

  // Profile URL with numeric ID
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  // Vanity URL
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/\s]+)/);
  if (vanityMatch) return resolveVanityURL(vanityMatch[1], apiKey);

  // Bare username (no slashes, not a number)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && !/^\d+$/.test(trimmed)) {
    return resolveVanityURL(trimmed, apiKey);
  }

  return null;
}

export interface SteamPlayerBans {
  SteamId: string;
  CommunityBanned: boolean;
  VACBanned: boolean;
  NumberOfVACBans: number;
  DaysSinceLastBan: number;
  NumberOfGameBans: number;
}

export async function getPlayerBans(
  steamId: string,
  apiKey: string,
): Promise<SteamPlayerBans | null> {
  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamids', steamId);

  const response = await fetchWithTimeout(url.toString(), {}, TIMEOUTS.STEAM_API);
  if (!response.ok) return null;

  const data = await response.json();
  return data.players?.[0] ?? null;
}

export async function getSteamLevel(steamId: string, apiKey: string): Promise<number | null> {
  const url = new URL('https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamid', steamId);

  const response = await fetchWithTimeout(url.toString(), {}, TIMEOUTS.STEAM_API);
  if (!response.ok) return null;

  const data = await response.json();
  return data.response?.player_level ?? null;
}

export async function getFriendCount(steamId: string, apiKey: string): Promise<number | null> {
  const url = new URL('https://api.steampowered.com/ISteamUser/GetFriendList/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamid', steamId);

  const response = await fetchWithTimeout(url.toString(), {}, TIMEOUTS.STEAM_API);
  if (!response.ok) return null; // Private friend list

  const data = await response.json();
  return data.friendslist?.friends?.length ?? null;
}

export async function getWishlistCount(steamId: string): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=0`,
      {},
      TIMEOUTS.STEAM_API,
    );
    if (!response.ok) return null;

    const data = await response.json();
    return Object.keys(data).length;
  } catch {
    return null;
  }
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
