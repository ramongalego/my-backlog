import type { SupabaseClient } from '@supabase/supabase-js';
import type { SteamGame } from './api';
import { findLegacyHeaderImages, getStoreHeaderImages } from './store-api';
import { chunk, fetchAllRows } from '@/lib/supabase/paginate';

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
}

/**
 * Brings a user's `games` rows in line with their Steam library: inserts games
 * they don't have yet and updates changed playtime. Existing rows (status,
 * rating, notes, synced metadata) are never touched otherwise.
 */
export async function syncOwnedGames(
  supabase: SupabaseClient,
  userId: string,
  steamGames: SteamGame[],
): Promise<LibrarySyncResult> {
  const existing = await fetchAllRows<{ app_id: number; playtime_forever: number | null }>(
    (from, to) =>
      supabase
        .from('games')
        .select('app_id, playtime_forever')
        .eq('user_id', userId)
        .order('app_id')
        .range(from, to),
  );
  const playtimeByAppId = new Map(existing.map((g) => [g.app_id, g.playtime_forever]));

  const newGames = steamGames.filter((game) => !playtimeByAppId.has(game.appid));
  const updatedGames = steamGames.filter(
    (game) =>
      playtimeByAppId.has(game.appid) && playtimeByAppId.get(game.appid) !== game.playtime_forever,
  );

  const headerImages = await headerImagesFor(
    supabase,
    newGames.map((game) => game.appid),
  );

  for (const batch of chunk(newGames, INSERT_BATCH_SIZE)) {
    const { error } = await supabase.from('games').insert(
      batch.map((game) => ({
        user_id: userId,
        app_id: game.appid,
        name: game.name,
        playtime_forever: game.playtime_forever,
        img_icon_url: game.img_icon_url,
        header_image: headerImages.get(game.appid) ?? null,
      })),
    );
    if (error) throw error;
  }

  for (const batch of chunk(updatedGames, UPDATE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map((game) =>
        supabase
          .from('games')
          .update({ playtime_forever: game.playtime_forever })
          .eq('user_id', userId)
          .eq('app_id', game.appid),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return { newGames: newGames.length, updatedPlaytime: updatedGames.length };
}

/** Removes a user's library and queue, used when they link a different Steam account. */
export async function clearLibrary(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error: queueError } = await supabase.from('playing_queue').delete().eq('user_id', userId);
  if (queueError) throw queueError;
  const { error: gamesError } = await supabase.from('games').delete().eq('user_id', userId);
  if (gamesError) throw gamesError;
}
