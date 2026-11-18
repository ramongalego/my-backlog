import { createClient } from '@/lib/supabase/client';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { needsSyncCheck } from '@/lib/games/metadata-cache';
import type { Game } from '@/types/games';

export type SyncCandidate = Game & {
  metadata_synced: boolean | null;
  main_story_hours: number | null;
  release_date: string | null;
};

/**
 * The query only narrows to the games that could need a sync; needsSyncCheck
 * decides. Release dates are display text, so "recent" is asked for as the two
 * years a date from the last twelve months can fall in.
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
