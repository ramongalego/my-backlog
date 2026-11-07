import type { GameWithImage } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

export interface CompletionCounts {
  gamesFinished: number;
  totalGames: number;
  /** Including the one just finished, for "your 5th game finished this year". */
  finishedThisYear?: number;
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
  finishedAt,
}: {
  finishedGame: GameWithImage;
  promoted: GameWithImage | null;
  counts: CompletionCounts;
  rating: number | null;
  /** The finish date chosen (YYYY-MM-DD), which can be in the past. */
  finishedAt: string;
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
    startedAt: finishedGame.started_at ?? null,
    finishedAt,
    finishedThisYear: counts.finishedThisYear ?? null,
  };
}
