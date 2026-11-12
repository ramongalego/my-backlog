import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { needsSyncCheck } from '@/lib/games/metadata-cache';
import type { Game } from '@/types/games';

/** One of the player's Steam games, with what decides whether it needs syncing. */
export type SyncCandidate = Game & {
  metadata_synced: boolean | null;
  main_story_hours: number | null;
  release_date: string | null;
};

/**
 * The player's Steam games that need a look from the sync endpoints on this
 * visit (needsSyncCheck decides which). The query only narrows it down to the
 * ones that could: on an established library that's a handful of rows, where
 * the whole library used to come down on every page load. Release dates are
 * display text, so "recent" is asked for as the two years a date from the last
 * twelve months can contain.
 */
export async function fetchGamesNeedingSync(userId: string): Promise<SyncCandidate[]> {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const couldNeedSync = [
    'metadata_synced.is.null',
    'metadata_synced.eq.false',
    'main_story_hours.is.null',
    `release_date.ilike.*${year}*`,
    `release_date.ilike.*${year - 1}*`,
  ].join(',');
  const games = await fetchAllRows<SyncCandidate>((from, to) =>
    supabase
      .from('games')
      .select(
        'app_id, name, type, categories, header_image, metadata_synced, main_story_hours, release_date',
      )
      .eq('user_id', userId)
      .eq('source', 'steam')
      .or(couldNeedSync)
      .order('app_id')
      .range(from, to),
  );

  const now = Date.now();
  return games.filter((game) => needsSyncCheck(game, now));
}
