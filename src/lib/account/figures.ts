import type { GameItem } from '@/lib/data/loaders';
import { countedInStats } from '@/lib/stats/compute';

/**
 * How many finished games must be rated before their average, and how the
 * ratings are spread, are shown. One game rated 10/10 isn't an average of
 * anything.
 */
export const MIN_RATED_FOR_AVERAGE = 5;

/** The figures in the profile's header. */
export interface ProfileFigures {
  /** Games in the library, as the Games page counts them: everything but hidden. */
  games: number;
  finished: number;
  /** Finished this calendar year. */
  finishedThisYear: number;
  /** Hours played, as Stats totals them (without hidden and won't-play games). */
  hours: number;
  /**
   * The average rating of the finished games, to one decimal, as Stats says it.
   * Null until enough are rated (MIN_RATED_FOR_AVERAGE): then it isn't shown.
   */
  avgRating: number | null;
}

export function profileFigures(games: GameItem[], now = new Date()): ProfileFigures {
  const year = String(now.getFullYear());
  const finished = games.filter((game) => game.status === 'finished');
  const minutes = countedInStats(games).reduce((sum, game) => sum + game.playtime_forever, 0);
  const ratings = finished.flatMap((game) => (game.rating == null ? [] : [game.rating]));
  return {
    games: games.filter((game) => game.status !== 'hidden').length,
    finished: finished.length,
    finishedThisYear: finished.filter((game) => game.finished_at?.slice(0, 4) === year).length,
    hours: Math.round(minutes / 60),
    avgRating:
      ratings.length >= MIN_RATED_FOR_AVERAGE
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
        : null,
  };
}

/**
 * How many finished games were given each rating, 0 to 10 (the index is the
 * rating), as Stats counts them. Null until enough are rated
 * (MIN_RATED_FOR_AVERAGE): a few ratings have no shape to show.
 */
export function ratingSpread(games: GameItem[]): number[] | null {
  const counts = Array.from({ length: 11 }, () => 0);
  let rated = 0;
  for (const game of games) {
    if (game.status !== 'finished' || game.rating == null) continue;
    // A rating is a whole number from 0 to 10; anything else has no bar.
    if (!(game.rating in counts)) continue;
    counts[game.rating] += 1;
    rated += 1;
  }
  return rated >= MIN_RATED_FOR_AVERAGE ? counts : null;
}
