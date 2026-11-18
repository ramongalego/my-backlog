import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOwnedGames } from '@/lib/steam/api';
import { getSteamApiKey } from '@/lib/server/env';

interface SteamHours {
  /** In minutes. */
  playtime_forever: number;
  /** Null when never played, or not shared. */
  last_played_at: string | null;
}

/**
 * For a game moving back from a console to Steam, so its total is saved with
 * the move: the history reads hours changed along with the platform as the
 * other platform's total, and later changes as time played. Null when Steam
 * can't say (not linked, no answer, playtime not shared, game not listed).
 */
export async function steamHoursOf(
  supabase: SupabaseClient,
  userId: string,
  gameId: number,
): Promise<SteamHours | null> {
  try {
    const [game, profile] = await Promise.all([
      supabase
        .from('games')
        .select('app_id')
        .eq('user_id', userId)
        .eq('id', gameId)
        .eq('source', 'steam')
        .maybeSingle(),
      supabase.from('profiles').select('steam_id').eq('id', userId).maybeSingle(),
    ]);
    const appId: number | null = game.data?.app_id ?? null;
    const steamId: string | null = profile.data?.steam_id ?? null;
    if (game.error || profile.error || appId === null || !steamId) return null;

    const owned = await getOwnedGames(steamId, getSteamApiKey());
    if (owned.isPrivate || owned.games.every((g) => g.playtime_forever === 0)) return null;
    const onSteam = owned.games.find((g) => g.appid === appId);
    if (!onSteam) return null;
    return {
      playtime_forever: onSteam.playtime_forever,
      last_played_at: onSteam.rtime_last_played
        ? new Date(onSteam.rtime_last_played * 1000).toISOString()
        : null,
    };
  } catch (err) {
    console.error("Reading a game's Steam hours failed:", err);
    return null;
  }
}
