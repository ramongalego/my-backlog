import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  playtime_2weeks?: number;
}

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
}

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
  return data.response?.games || [];
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
  return data.response?.players?.[0] || null;
}
