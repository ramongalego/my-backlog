import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameWithImage } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

export interface CompletionCounts {
  gamesFinished: number;
  totalGames: number;
}

/**
 * Counts used by the "game finished" summary: how many games the user has
 * finished, and the total library size (excluding hidden). Shared by the home
 * page and the playing-queue page so the two stay in lockstep.
 */
export async function fetchCompletionCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<CompletionCounts> {
  const [{ count: finishedCount }, { count: totalCount }] = await Promise.all([
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
  ]);

  return { gamesFinished: finishedCount ?? 0, totalGames: totalCount ?? 0 };
}

/**
 * Builds the GameSummaryData shown after finishing a game. Extracted so the
 * home and queue flows produce identical summaries (previously duplicated
 * line-for-line in both hooks).
 */
export function buildCompletionSummary({
  finishedGame,
  promoted,
  counts,
  rating,
}: {
  finishedGame: GameWithImage;
  promoted: GameWithImage | null;
  counts: CompletionCounts;
  rating: number | null;
}): GameSummaryData {
  const hours = (finishedGame.main_story_hours ?? 0) > 0 ? finishedGame.main_story_hours : null;

  return {
    gameName: finishedGame.name,
    headerImage: finishedGame.header_image,
    playtimeMinutes: finishedGame.playtime_forever,
    mainStoryHours: hours,
    rating,
    gamesFinished: counts.gamesFinished,
    totalGames: counts.totalGames,
    backlogHoursRemoved: hours,
    nextGame: promoted?.name ?? null,
  };
}
