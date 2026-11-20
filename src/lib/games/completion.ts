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
  nextGameImage?: string | null;
  /**
   * For how long it took: the day it was started, only where that can be told
   * for certain (a clean run from start to finish, see cleanStartOf).
   */
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

/** Shared by the Home and Queue finish flows, so their summaries match. */
export function buildCompletionSummary({
  finishedGame,
  promoted,
  counts,
  rating,
  finishedAt,
  startedAt = null,
}: {
  finishedGame: GameWithImage;
  promoted: GameWithImage | null;
  counts: CompletionCounts;
  rating: number | null;
  /** The finish date chosen (YYYY-MM-DD), which can be in the past. */
  finishedAt: string;
  /** As the server tells it, or null until it has (see GameSummaryData). */
  startedAt?: string | null;
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
    startedAt,
    finishedAt,
    finishedThisYear: counts.finishedThisYear ?? null,
  };
}
