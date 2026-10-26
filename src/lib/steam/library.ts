import type { SupabaseClient } from '@supabase/supabase-js';
import type { SteamGame } from './api';
import { findLegacyHeaderImages, getStoreHeaderImages } from './store-api';
import { chunk, fetchAllRows } from '@/lib/supabase/paginate';
import { playsOnConsole, STEAM_PLATFORM } from '@/lib/games/consoles';

const INSERT_BATCH_SIZE = 500;
const UPDATE_CONCURRENCY = 25;
const CACHE_LOOKUP_BATCH = 200;

/**
 * Header art for newly imported games, so the library has covers while the
 * metadata sync is still running: the shared cache first, then the store, then
 * Steam's old fixed path for delisted games. Art is nice to have, so a failed
 * lookup just leaves the game without it until its metadata syncs.
 */
async function headerImagesFor(
  supabase: SupabaseClient,
  appIds: number[],
): Promise<Map<number, string>> {
  const images = new Map<number, string>();
  try {
    for (const batch of chunk(appIds, CACHE_LOOKUP_BATCH)) {
      const { data } = await supabase
        .from('game_metadata')
        .select('app_id, header_image')
        .in('app_id', batch)
        .not('header_image', 'is', null);
      for (const row of data ?? []) images.set(row.app_id, row.header_image);
    }

    const fromStore = await getStoreHeaderImages(appIds.filter((id) => !images.has(id)));
    fromStore.forEach((url, id) => images.set(id, url));

    const legacy = await findLegacyHeaderImages(appIds.filter((id) => !images.has(id)));
    legacy.forEach((url, id) => images.set(id, url));
  } catch (err) {
    console.error('Header image lookup failed:', err);
  }
  return images;
}

export interface LibrarySyncResult {
  newGames: number;
  updatedPlaytime: number;
  /** Rows changed at all, including a new last-played date with the same hours. */
  updatedGames: number;
}

/**
 * Brings a user's `games` rows in line with their Steam library: inserts games
 * they don't have yet and updates changed playtime and last-played dates.
 * Existing rows (status, rating, notes, synced metadata) are never touched
 * otherwise.
 */
export async function syncOwnedGames(
  supabase: SupabaseClient,
  userId: string,
  steamGames: SteamGame[],
): Promise<LibrarySyncResult> {
  const existing = await fetchAllRows<{
    app_id: number;
    playtime_forever: number | null;
    last_played_at: string | null;
    platform: string | null;
  }>((from, to) =>
    supabase
      .from('games')
      .select('app_id, playtime_forever, last_played_at, platform')
      .eq('user_id', userId)
      .eq('source', 'steam')
      .order('app_id')
      .range(from, to),
  );
  const stored = new Map(existing.map((g) => [g.app_id, g]));

  const newGames = steamGames.filter((game) => !stored.has(game.appid));
  const playtimeChanged = (game: SteamGame) =>
    stored.get(game.appid)?.playtime_forever !== game.playtime_forever;
  // Only when Steam shares a date: a private profile shouldn't wipe a known one.
  const lastPlayedChanged = (game: SteamGame) => {
    const steam = lastPlayedAt(game);
    const known = stored.get(game.appid)?.last_played_at;
    return steam !== null && (!known || Date.parse(known) !== Date.parse(steam));
  };
  // A Steam game you play on a console keeps the hours you entered: Steam's
  // playtime and last-played are for the PC copy.
  const onConsole = (game: SteamGame) => playsOnConsole(stored.get(game.appid)?.platform);
  const updatedGames = steamGames.filter(
    (game) =>
      stored.has(game.appid) &&
      !onConsole(game) &&
      (playtimeChanged(game) || lastPlayedChanged(game)),
  );

  const headerImages = await headerImagesFor(
    supabase,
    newGames.map((game) => game.appid),
  );

  for (const batch of chunk(newGames, INSERT_BATCH_SIZE)) {
    const { error } = await supabase.from('games').insert(
      batch.map((game) => ({
        user_id: userId,
        source: 'steam',
        app_id: game.appid,
        platform: STEAM_PLATFORM,
        name: game.name,
        playtime_forever: game.playtime_forever,
        img_icon_url: game.img_icon_url,
        header_image: headerImages.get(game.appid) ?? null,
        last_played_at: lastPlayedAt(game),
      })),
    );
    if (error) throw error;
  }

  for (const batch of chunk(updatedGames, UPDATE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map((game) => {
        const lastPlayed = lastPlayedAt(game);
        return (
          supabase
            .from('games')
            .update({
              playtime_forever: game.playtime_forever,
              ...(lastPlayed ? { last_played_at: lastPlayed } : {}),
            })
            .eq('user_id', userId)
            .eq('app_id', game.appid)
            // Not if it was moved to a console since this sync read the library.
            .or(`platform.is.null,platform.eq.${STEAM_PLATFORM}`)
        );
      }),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return {
    newGames: newGames.length,
    updatedPlaytime: updatedGames.filter(playtimeChanged).length,
    updatedGames: updatedGames.length,
  };
}

/** Steam's last-played time as ISO, or null (never played, or not shared). */
function lastPlayedAt(game: SteamGame): string | null {
  return game.rtime_last_played ? new Date(game.rtime_last_played * 1000).toISOString() : null;
}

/**
 * Removes a user's Steam games, used when they link a different Steam account.
 * Their queue entries go with them (the queue references its games); games
 * that didn't come from Steam stay.
 */
export async function clearLibrary(supabase: SupabaseClient, userId: string): Promise<void> {
  // Games moved to a console are console games now: keep them (with their
  // diary history), as games added by hand. Without the old account's app id,
  // the new account can own the same game without clashing.
  const { error: keepError } = await supabase
    .from('games')
    .update({ source: 'manual', app_id: null })
    .eq('user_id', userId)
    .eq('source', 'steam')
    .not('platform', 'is', null)
    .neq('platform', STEAM_PLATFORM);
  if (keepError) throw keepError;

  const { error } = await supabase
    .from('games')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'steam');
  if (error) throw error;
}
