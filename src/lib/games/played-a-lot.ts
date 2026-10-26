import { isMultiplayerFirst, isPlayedOut } from './carousels';

export interface PlayedGame {
  id: number;
  status: string | null;
  playtime_forever: number;
  main_story_hours: number | null;
  categories: string[] | null;
  tags: string[] | null;
}

// Hours in a game you play rather than finish (multiplayer, or no story time)
// before it counts as "played a lot".
const OPEN_ENDED_MIN_MINUTES = 10 * 60;
const LIST_SIZE = 5;

/**
 * Backlog games that are probably not backlog any more: played past most of
 * their main story, or 10+ hours into a game you play rather than finish.
 * It's the other half of Pick Up Where You Left Off (which leaves these out),
 * shown on Stats as a nudge to mark them finished, dropped or hidden. Queued
 * games are left out: you've just decided to play those.
 */
export function playedALot<T extends PlayedGame>(
  games: T[],
  queuedGameIds: ReadonlySet<number> = new Set(),
): T[] {
  return games
    .filter(
      (g) =>
        (!g.status || g.status === 'backlog') &&
        !queuedGameIds.has(g.id) &&
        (isPlayedOut(g) ||
          ((isMultiplayerFirst(g) || !g.main_story_hours) &&
            g.playtime_forever >= OPEN_ENDED_MIN_MINUTES)),
    )
    .sort((a, b) => b.playtime_forever - a.playtime_forever || a.id - b.id)
    .slice(0, LIST_SIZE);
}
