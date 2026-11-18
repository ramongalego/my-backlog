import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';
import { releaseYear } from '@/lib/games/release-date';
import { SHORTEST_RECHECK_DAYS, timeToBeatCheckDue } from '@/lib/games/time-to-beat-check';

// Searches per daily refresh, so a big batch of new games doesn't use up
// HowLongToBeat's allowance (it blocks after roughly 60–80 searches).
const MAX_PER_REFRESH = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ManualGame {
  id: number;
  name: string;
  release_date: string | null;
  main_story_hours: number | null;
  hltb_checked_at: string | null;
}

/**
 * Games without a time, and recent releases, whose time still moves (see
 * timeToBeatCheckDue). Steam games get theirs through the metadata cache's own
 * retries. Returns how many games got a time, or a different one.
 */
export async function recheckManualHours(
  supabase: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  // Release dates are display text, so which games are due is worked out
  // here; the query only leaves out the ones checked too recently to be.
  const checkedBefore = new Date(now.getTime() - SHORTEST_RECHECK_DAYS * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('games')
    .select('id, name, release_date, main_story_hours, hltb_checked_at')
    .eq('user_id', userId)
    .eq('source', 'manual')
    .or(`hltb_checked_at.is.null,hltb_checked_at.lt.${checkedBefore}`)
    .order('hltb_checked_at', { ascending: true, nullsFirst: true });
  if (error) throw error;
  const due = ((data ?? []) as ManualGame[])
    .filter((game) => timeToBeatCheckDue(game, now.getTime()))
    .slice(0, MAX_PER_REFRESH);

  let changed = 0;
  for (const game of due) {
    let hours: number | null;
    try {
      hours = await getMainStoryHours(game.name, releaseYear(game.release_date));
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
        // No answer keeps the time it has: a failed lookup isn't "no time".
        ...(hours !== null ? { main_story_hours: hours } : {}),
      })
      .eq('user_id', userId)
      .eq('id', game.id);
    if (updateError) console.error(updateError);
    else if (hours !== null && hours !== game.main_story_hours) changed++;
  }
  return changed;
}
