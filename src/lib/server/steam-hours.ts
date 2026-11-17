import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOwnedGames } from '@/lib/steam/api';
import { getSteamApiKey } from '@/lib/server/env';

/** What Steam has for one game right now. */
interface SteamHours {
  /** Its total, in minutes. */
  playtime_forever: number;
  /** When it was last played on Steam; null when never, or not shared. */
  last_played_at: string | null;
}

/**
 * Steam's hours for one of the player's Steam games, asked for now. Used
 * when a game moves back from a console to Steam, so its Steam total is saved
 * with the move: the history reads hours that change along with the platform
 * as the other platform's total, and hours that change later as time played.
 *
 * Null when Steam can't say: the account isn't linked, Steam doesn't answer,
 * isn't sharing the library or its playtime (every game at 0 minutes, as the
 * sync takes it too), or doesn't list the game. The next sync brings the
 * hours then.
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
