import type { GameItem } from '@/lib/data/loaders';
import { toLocalIsoDate } from '@/lib/diary/date-utils';
import { playsOf, type HistoryEvent } from './history';

// The Profile page's activity list. It reads game_events for everything since
// the history began, and the games themselves for what came before it.

export type ActivityKind =
  | 'playing'
  | 'started'
  | 'finished'
  | 'dropped'
  | 'added'
  | 'queued'
  | 'paused'
  | 'unqueued'
  | 'backlog'
  | 'wont_play'
  | 'rated'
  | 'moved'
  | 'favorite'
  | 'unfavorite'
  | 'note'
  | 'played';

export interface ActivityLine {
  /** `playing` is the start of the game being played now; `started`, of one that isn't any more. */
  kind: ActivityKind;
  /** The time played, in minutes, for `played`. */
  minutes?: number;
  /** Where the game went, for `moved`. */
  to?: string;
  /** The rating that came with it: a finish, a drop, or a rating given by itself. */
  rating?: number;
  /** "YYYY-MM-DD" the player chose for a finish or a drop, when it isn't the day it was logged. */
  on?: string;
}

/** What happened to one game in one go: one row of the list. */
export interface ActivityEntry {
  /** Unique in the list, and stays the same as more is done to the game. */
  key: string;
  id: number;
  name: string;
  header_image: string | null;
  source: string;
  platform: string | null;
  /** Oldest first. */
  lines: ActivityLine[];
  /** "YYYY-MM-DD" the latest line was logged, which the list groups by; null when unknown. */
  day: string | null;
  /** Your rating, where one of them is about it: a finish, a drop, a rating. */
  rating: number | null;
  /**
   * For a group, each game's own entry, newest first. The group entry says what
   * was done to all of them, with the first game's id, name and art.
   */
  games?: ActivityEntry[];
}

export interface ActivityEvent extends HistoryEvent {
  id: number;
  game_id: number;
}

interface PlayingGame {
  id: number;
  started_at?: string | null;
}

type Told = Omit<ActivityLine, 'rating'> & { day?: string; rating?: number | null };

interface Item {
  /** A moment, a day, or '' when nothing says. */
  at: string;
  /** The event id, to order two lines at the same moment. */
  order: number;
  key: string;
  game: GameItem;
  line: ActivityLine;
  day: string | null;
  rating: number | null;
}

/** The most entries the list holds. */
export const RECENT_ACTIVITY = 50;

/** More than this many games in a row with the same thing done on one day are one row. */
const GROUP_MORE_THAN = 3;

/**
 * Time played, a move and a rating each say something of their own, and only
 * one game is being played, so those never group.
 */
const GROUPABLE = new Set<ActivityKind>([
  'started',
  'finished',
  'dropped',
  'added',
  'queued',
  'paused',
  'unqueued',
  'backlog',
  'wont_play',
  'favorite',
  'unfavorite',
  'note',
]);

/** Things done to one game this close together, with nothing else between, are one entry. */
const SAME_GO_MS = 12 * 60 * 60 * 1000;

/** A day saved as midnight UTC ("2026-11-16T00:00:00+00:00"): read straight off it. */
const savedDay = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : null);

/**
 * Null when the event is worth no line (a game hidden, a date corrected, a note
 * cleared, hours corrected down). An event with several changes gives its main one.
 */
function told(event: ActivityEvent): Told | null {
  const { changes } = event;
  const now = (name: string) => changes[name]?.[1];
  const rating = typeof now('rating') === 'number' ? (now('rating') as number) : null;

  if ('status' in changes) {
    switch (now('status')) {
      case 'finished':
        // The day the player chose, which can be long before it was logged.
        return { kind: 'finished', day: savedDay(now('finished_at')) ?? undefined, rating };
      case 'dropped':
        return { kind: 'dropped', day: savedDay(now('dropped_at')) ?? undefined, rating };
      case 'playing':
        return { kind: 'started' };
      case 'wont_play':
        return { kind: 'wont_play' };
      case 'backlog':
        // Put on the queue as it stopped being played: paused for another game.
        if (now('queued') === true) {
          return { kind: changes.status[0] === 'playing' ? 'paused' : 'queued' };
        }
        return { kind: event.kind === 'added' ? 'added' : 'backlog' };
      default:
        return null;
    }
  }
  if (rating !== null) return { kind: 'rated', rating };
  if (typeof now('platform') === 'string') return { kind: 'moved', to: now('platform') as string };
  if ('queued' in changes) return { kind: now('queued') === true ? 'queued' : 'unqueued' };
  if ('favorite' in changes) return { kind: now('favorite') === true ? 'favorite' : 'unfavorite' };
  if (now('noted') === true) return { kind: 'note' };
  const [play] = playsOf([event]);
  return play ? { kind: 'played', minutes: play.minutes } : null;
}

/** Oldest first, with time played in a row added up. */
function linesOf(newestFirst: Item[]): ActivityLine[] {
  const lines: ActivityLine[] = [];
  for (const { line } of [...newestFirst].reverse()) {
    const last = lines.at(-1);
    if (line.kind === 'played' && last?.kind === 'played') {
      lines[lines.length - 1] = { ...last, minutes: (last.minutes ?? 0) + (line.minutes ?? 0) };
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/**
 * Newest first, by when each thing was logged (a finish or drop from before the
 * history, by its day). Hidden games, games no longer in the library, and a
 * finish or drop saved without a date are left out.
 */
export function recentActivity(
  games: GameItem[],
  playing: PlayingGame | null,
  events: ActivityEvent[] = [],
): ActivityEntry[] {
  const shown = new Map(games.filter((game) => game.status !== 'hidden').map((g) => [g.id, g]));

  const logged = events.flatMap((event): Item[] => {
    const game = shown.get(event.game_id);
    const what = game && told(event);
    if (!game || !what) return [];
    const { day: chosen, rating, ...rest }: Told = what;
    const line: ActivityLine = rest;
    const loggedOn = toLocalIsoDate(new Date(event.created_at));
    if (chosen && chosen !== loggedOn) line.on = chosen;
    if (rating != null) line.rating = rating;
    return [
      {
        at: event.created_at,
        order: event.id,
        key: `event-${event.id}`,
        game,
        line,
        day: loggedOn,
        rating: rating ?? null,
      },
    ];
  });

  // The latest start of the game being played is the one it is playing from.
  const startOf = new Map<number, number>();
  for (const item of logged) {
    if (item.line.kind === 'started' && item.game.status === 'playing') {
      startOf.set(item.game.id, Math.max(startOf.get(item.game.id) ?? 0, item.order));
    }
  }
  for (const item of logged) {
    if (startOf.get(item.game.id) === item.order) item.line = { kind: 'playing' };
  }

  // What the games themselves say, where the history doesn't: a game being
  // played since before it began, and what was finished or dropped before it.
  const alreadyTold = new Set(
    logged.map((item) => `${item.game.id} ${item.line.kind} ${item.line.on ?? item.day}`),
  );
  const before = [...shown.values()].flatMap((game): Item[] => {
    const from = (line: ActivityLine, at: string, day: string | null, rating: number | null) => [
      { at, order: 0, key: `game-${game.id}`, game, line, day, rating },
    ];
    if (game.status === 'playing') {
      if (startOf.has(game.id)) return [];
      // The day in the player's own time zone.
      const started = playing?.id === game.id ? (playing.started_at ?? null) : null;
      const day = started ? toLocalIsoDate(new Date(started)) : null;
      return from({ kind: 'playing' }, started ?? '', day, null);
    }
    const kind =
      game.status === 'finished' ? 'finished' : game.status === 'dropped' ? 'dropped' : null;
    const day = savedDay(kind === 'finished' ? game.finished_at : kind && game.dropped_at);
    if (!kind || !day || alreadyTold.has(`${game.id} ${kind} ${day}`)) return [];
    return from(
      { kind, ...(game.rating != null ? { rating: game.rating } : {}) },
      day,
      day,
      game.rating,
    );
  });

  const items: Item[] = [...logged, ...before].sort(
    (a, b) => b.at.localeCompare(a.at) || b.order - a.order || b.game.id - a.game.id,
  );

  const runs: Item[][] = [];
  for (const item of items) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    const gap = last ? Date.parse(last.at) - Date.parse(item.at) : NaN;
    if (run && last && last.game.id === item.game.id && gap <= SAME_GO_MS) run.push(item);
    else runs.push([item]);
  }

  const made = runs.map((run) => {
    const [newest] = run;
    const { game } = newest;
    const entry: ActivityEntry = {
      // The run's first line: more done to the game since keeps the row its own.
      key: run.at(-1)!.key,
      id: game.id,
      name: game.name,
      header_image: game.header_image,
      source: game.source,
      platform: game.platform,
      lines: linesOf(run),
      day: newest.day,
      rating: run.find((item) => item.rating !== null)?.rating ?? null,
    };
    // One thing done to one game, logged on a day: what a group is made of.
    const groupable =
      run.length === 1 && newest.at.includes('T') && GROUPABLE.has(newest.line.kind);
    return { entry, groupable };
  });

  // Games moved one by one group the same as games moved together (Games, Select).
  const sameMove = (a: (typeof made)[number], b: (typeof made)[number]) =>
    a.groupable &&
    b.groupable &&
    a.entry.day === b.entry.day &&
    a.entry.lines[0].kind === b.entry.lines[0].kind;
  const entries: ActivityEntry[] = [];
  for (let i = 0; i < made.length;) {
    let end = i + 1;
    while (end < made.length && sameMove(made[i], made[end])) end++;
    const group = made.slice(i, end).map((one) => one.entry);
    if (group.length > GROUP_MORE_THAN) {
      const [first] = group;
      // A finish or a drop says its own day when every game shares it.
      const on = group.every((one) => one.lines[0].on === first.lines[0].on)
        ? first.lines[0].on
        : undefined;
      entries.push({
        ...first,
        key: `bulk-${group.at(-1)!.key}`,
        name: `${group.length} games`,
        // What was done to all of them; each game keeps its own rating.
        lines: [{ kind: first.lines[0].kind, ...(on ? { on } : {}) }],
        rating: null,
        games: group,
      });
    } else {
      entries.push(...group);
    }
    i = end;
  }
  return entries.slice(0, RECENT_ACTIVITY);
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

/** The stamp beside the list's rows; `year` only for a day in another year. */
export function activityStamp(
  day: string,
  now = new Date(),
): { day: string; month: string; year: string | null } {
  const date = new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  );
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    year: date.getFullYear() === now.getFullYear() ? null : String(date.getFullYear()),
  };
}

/** "45m", "2h" or "2h 30m". */
export function playedFor(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
