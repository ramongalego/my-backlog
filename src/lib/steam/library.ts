import type { SupabaseClient } from '@supabase/supabase-js';
import type { SteamGame } from './api';
import { chunk, fetchAllRows } from '@/lib/supabase/paginate';

const INSERT_BATCH_SIZE = 500;
const UPDATE_CONCURRENCY = 25;

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

  for (const batch of chunk(newGames, INSERT_BATCH_SIZE)) {
    const { error } = await supabase.from('games').insert(
      batch.map((game) => ({
        user_id: userId,
        app_id: game.appid,
        name: game.name,
        playtime_forever: game.playtime_forever,
        img_icon_url: game.img_icon_url,
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
