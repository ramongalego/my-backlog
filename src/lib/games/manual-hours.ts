import type { SupabaseClient } from '@supabase/supabase-js';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';

// A game HowLongToBeat has no time for is usually not out yet, or only just
// out: worth asking again, but not often.
const RECHECK_DAYS = 7;
// Searches per daily refresh, so a big batch of new games doesn't use up
// HowLongToBeat's allowance (it blocks after roughly 60–80 searches).
const MAX_PER_REFRESH = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Looks up the time to beat again for a user's games added by hand that
 * still have none, each at most once a week, oldest check first. Steam games
 * get theirs through the shared metadata cache's own retries. Runs with the
 * daily review refresh; returns how many games got a time.
 */
export async function recheckMissingHours(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  const checkedBefore = new Date(now.getTime() - RECHECK_DAYS * DAY_MS).toISOString();
  const { data: games, error } = await supabase
    .from('games')
    .select('id, name')
    .eq('user_id', userId)
    .eq('source', 'manual')
    .is('main_story_hours', null)
    .or(`hltb_checked_at.is.null,hltb_checked_at.lt.${checkedBefore}`)
    .order('hltb_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_REFRESH);
  if (error) throw error;

  let found = 0;
  for (const game of games ?? []) {
    let hours: number | null;
    try {
      hours = await getMainStoryHours(game.name);
    } catch (err) {
      // Refusing requests says nothing about the game: the rest wait for the
      // next refresh, unmarked.
      if (err instanceof HLTBUnavailableError) break;
      throw err;
    }
    const { error: updateError } = await supabase
      .from('games')
      .update({
        hltb_checked_at: now.toISOString(),
        ...(hours !== null ? { main_story_hours: hours } : {}),
      })
      .eq('user_id', userId)
      .eq('id', game.id);
    if (updateError) console.error(updateError);
    else if (hours !== null) found++;
  }
  return found;
}
