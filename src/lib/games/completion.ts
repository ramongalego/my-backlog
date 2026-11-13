import type { GameWithImage } from '@/types/games';

/** What the "game finished" summary shows, and what sharing it starts from. */
export interface GameSummaryData {
  /** The finished game's row id: all sharing sends. */
  gameId: number;
  gameName: string;
  headerImage: string | null;
  playtimeMinutes: number;
  mainStoryHours: number | null;
  rating: number | null;
  gamesFinished: number;
  totalGames: number;
  nextGame: string | null;
  /** The next game's art, beside its name. */
  nextGameImage?: string | null;
  /** When you started playing it, for how long it took. */
  startedAt?: string | null;
  /** The finish date chosen (YYYY-MM-DD). */
  finishedAt?: string | null;
  /** Games finished this year, counting this one. */
  finishedThisYear?: number | null;
}

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
    gameId: finishedGame.id,
    gameName: finishedGame.name,
    headerImage: finishedGame.header_image,
    playtimeMinutes: finishedGame.playtime_forever,
    mainStoryHours: hours,
    rating,
    gamesFinished: counts.gamesFinished,
    totalGames: counts.totalGames,
    nextGame: promoted?.name ?? null,
    nextGameImage: promoted?.header_image ?? null,
    startedAt: finishedGame.started_at ?? null,
    finishedAt,
    finishedThisYear: counts.finishedThisYear ?? null,
  };
}
