import type { GameItem } from '@/lib/data/loaders';
import { countedInStats } from '@/lib/stats/compute';

/** The four figures in the profile's header. */
export interface ProfileFigures {
  /** Games in the library, as the Games page counts them: everything but hidden. */
  games: number;
  finished: number;
  /** Finished this calendar year. */
  finishedThisYear: number;
  /** Hours played, as Stats totals them (without hidden and won't-play games). */
  hours: number;
}

export function profileFigures(games: GameItem[], now = new Date()): ProfileFigures {
  const year = String(now.getFullYear());
  const finished = games.filter((game) => game.status === 'finished');
  const minutes = countedInStats(games).reduce((sum, game) => sum + game.playtime_forever, 0);
  return {
    games: games.filter((game) => game.status !== 'hidden').length,
    finished: finished.length,
    finishedThisYear: finished.filter((game) => game.finished_at?.slice(0, 4) === year).length,
    hours: Math.round(minutes / 60),
  };
}
