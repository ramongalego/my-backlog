import { isMultiplayerFirst, isPlayedOut } from './carousels';

export interface PlayedGame {
  id: number;
  status: string;
  playtime_forever: number;
  main_story_hours: number | null;
  categories: string[] | null;
  tags: string[] | null;
}

// Hours in a game you play rather than finish (multiplayer, or no story time)
// before it counts as "played a lot".
export const OPEN_ENDED_MIN_MINUTES = 10 * 60;
const LIST_SIZE = 5;

/**
 * Backlog games that probably aren't any more, for Stats to nudge (Pick Up Where
 * You Left Off leaves these out). Queued games are left out: just chosen to play.
 */
export function playedALot<T extends PlayedGame>(
  games: T[],
  queuedGameIds: ReadonlySet<number> = new Set(),
): T[] {
  return games
    .filter(
      (g) =>
        g.status === 'backlog' &&
        !queuedGameIds.has(g.id) &&
        (isPlayedOut(g) ||
          ((isMultiplayerFirst(g) || !g.main_story_hours) &&
            g.playtime_forever >= OPEN_ENDED_MIN_MINUTES)),
    )
    .sort((a, b) => b.playtime_forever - a.playtime_forever || a.id - b.id)
    .slice(0, LIST_SIZE);
}
