import type { GameItem } from '@/lib/data/loaders';
import { toLocalIsoDate } from '@/lib/diary/date-utils';

// What a player has been doing lately, for their Profile page: the game they're
// playing, then the games they finished or dropped, newest first.

type ActivityKind = 'playing' | 'finished' | 'dropped';

export interface ActivityEntry {
  id: number;
  kind: ActivityKind;
  name: string;
  header_image: string | null;
  source: string;
  platform: string | null;
  /** The day it happened, "YYYY-MM-DD"; null for a game being played with no start saved. */
  day: string | null;
  /** Your rating, for a finished or dropped game that has one. */
  rating: number | null;
}

/** The game being played, as the playing query gives it. */
interface PlayingGame {
  id: number;
  started_at?: string | null;
}

const DEFAULT_LIMIT = 6;

/**
 * The newest things first, up to `limit`. The game being played leads: it's
 * what's happening now, whenever it was started. A finished or dropped game
 * saved without a date has no place in time, so it's left out.
 */
export function recentActivity(
  games: GameItem[],
  playing: PlayingGame | null,
  limit = DEFAULT_LIMIT,
): ActivityEntry[] {
  const entry = (game: GameItem, kind: ActivityKind, day: string | null): ActivityEntry => ({
    id: game.id,
    kind,
    name: game.name,
    header_image: game.header_image,
    source: game.source,
    platform: game.platform,
    day,
    rating: kind === 'playing' ? null : game.rating,
  });

  const now = games
    .filter((game) => game.status === 'playing')
    .map((game) => {
      // Started at a real moment: the day it was where the player is.
      const started = playing?.id === game.id ? playing.started_at : null;
      return entry(game, 'playing', started ? toLocalIsoDate(new Date(started)) : null);
    });

  const done = games
    .flatMap((game) => {
      // Saved as a day (midnight UTC), so the day is read straight off it.
      if (game.status === 'finished' && game.finished_at)
        return [entry(game, 'finished', game.finished_at.slice(0, 10))];
      if (game.status === 'dropped' && game.dropped_at)
        return [entry(game, 'dropped', game.dropped_at.slice(0, 10))];
      return [];
    })
    .sort((a, b) => b.day!.localeCompare(a.day!) || b.id - a.id);

  return [...now, ...done].slice(0, limit);
}

/** "Oct 9", or "Oct 9, 2025" for a day in another year. */
export function activityDay(day: string, now = new Date()): string {
  const date = new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  );
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
