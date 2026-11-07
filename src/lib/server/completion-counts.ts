import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompletionCounts } from '@/lib/games/completion';

/**
 * Counts used by the "game finished" summary: how many games the user has
 * finished, and the total library size (excluding hidden). Shared by the home
 * page and the playing-queue page so the two stay in lockstep.
 */
export async function fetchCompletionCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<CompletionCounts> {
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [{ count: finishedCount }, { count: totalCount }, { count: thisYearCount }] =
    await Promise.all([
      supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'game')
        .eq('status', 'finished'),
      supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'game')
        .neq('status', 'hidden'),
      supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'game')
        .eq('status', 'finished')
        .gte('finished_at', yearStart),
    ]);

  return {
    gamesFinished: finishedCount ?? 0,
    totalGames: totalCount ?? 0,
    finishedThisYear: thisYearCount ?? undefined,
  };
}
