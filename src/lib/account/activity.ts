import type { GameItem } from '@/lib/data/loaders';
import { toLocalIsoDate } from '@/lib/diary/date-utils';
import { daysApart } from '@/lib/games/played-over';
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
  | 'rerated'
  | 'moved'
  | 'favorite'
  | 'unfavorite'
  | 'note'
  | 'played';

export interface ActivityLine {
  /** `playing` is the start of the game being played now; `started`, of one that isn't any more. */
  kind: ActivityKind;
  /** In minutes: the time played, for `played`; for `finished`, the hours it took. */
  minutes?: number;
  /** For `played`, in minutes: the game's hours after it, where it was played before. */
  total?: number;
  /** Where the game went, for `moved`. */
  to?: string;
  /** The rating that came with it: a finish, a drop, or a rating given by itself. */
  rating?: number;
  /** For `rerated`: the rating it replaced. */
  from?: number;
  /**
   * A start that came from a pick: Random, or Pick My Game's questions. For a
   * finish, the start it was played from.
   */
  pickedBy?: PickKind;
  /** For `finished`: whole days from the day it was started to the day it was finished. */
  days?: number;
}

/** One thing done to a game, or a group of them: one row of the list. */
export interface ActivityEntry {
  /** Unique in the list. */
  key: string;
  id: number;
  name: string;
  header_image: string | null;
  source: string;
  platform: string | null;
  /** One, but for a group: what was done to its games, or each of a game's updates, oldest first. */
  lines: ActivityLine[];
  /** "YYYY-MM-DD" the latest line was logged, which the list groups by; null when unknown. */
  day: string | null;
  /** When the latest line was logged: a moment, a day (from before the history), or '' when nothing says. */
  at: string;
  /** Your rating, where one of them is about it: a finish, a drop, a rating. */
  rating: number | null;
  /**
   * For a group, each game's own entry, newest first. The group entry says what
   * was done to all of them, with the first game's id, name and art.
   */
  games?: ActivityEntry[];
  /** For several things done to one game in a row, each its own entry, newest first. */
  updates?: ActivityEntry[];
}

export interface ActivityEvent extends HistoryEvent {
  id: number;
  game_id: number;
  /**
   * When the last change folded into it was made. Changes within a minute
   * are one event: it says what they came to, so that is when it happened.
   */
  updated_at?: string;
}

/**
 * The longest a sitting runs from its first change to its last. An Undo
 * pressed later than this (a toast that waited in a background tab) is
 * folded into the event it undoes and moves its last change to now: that
 * isn't when the event happened.
 */
const SITTING_MS = 10 * 60 * 1000;

/** When an event happened: its last change, where the history says and it is a sitting. */
export function happened(event: ActivityEvent): string {
  const { created_at: first, updated_at: last } = event;
  return last && Date.parse(last) - Date.parse(first) <= SITTING_MS ? last : first;
}

type PickKind = 'random' | 'questions';

/** A pick the player pressed Play on (game_picks with the outcome `played`). */
export interface PlayedPick {
  game_id: number;
  kind: PickKind;
  /** When Play was pressed. */
  answered_at: string;
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

/** More than this many things done to one game in a row are one row, which unfolds. */
const SAME_GAME_MORE_THAN = 2;

/**
 * What a profile shows to other people: what someone following the player
 * would have something to say about. What was played, finished, dropped, a
 * rating changed, and a favorite. A first rating goes with its finish or drop,
 * and the rest is housekeeping (the backlog, the queue, Won't Play, a move to
 * a console, a favorite taken off, a note, a pause), which stays the player's
 * own.
 */
export const HIGHLIGHTS: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
  'playing',
  'started',
  'finished',
  'dropped',
  'rerated',
  'played',
  'favorite',
]);

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

/**
 * How far apart Play on a pick and the start it made can be logged. They are
 * saved by two requests, a moment apart, and either can land first.
 */
const PICKED_WITHIN_MS = 2 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether two "YYYY-MM-DD" days are the same or next to each other. */
const withinADay = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= DAY_MS;

/**
 * Which start each pick made, by the event's id: the start of that game
 * logged closest to Play being pressed. One start for a pick, so the same
 * game started again by hand soon after says nothing of it.
 */
function startsFromPicks(events: ActivityEvent[], picks: PlayedPick[]): Map<number, PickKind> {
  const starts = events.filter((event) => event.changes.status?.[1] === 'playing');
  const made = new Map<number, PickKind>();
  for (const pick of picks) {
    const pressed = Date.parse(pick.answered_at);
    const apart = (event: ActivityEvent) => Math.abs(Date.parse(happened(event)) - pressed);
    const [start] = starts
      .filter(
        (event) =>
          event.game_id === pick.game_id && !made.has(event.id) && apart(event) <= PICKED_WITHIN_MS,
      )
      .sort((a, b) => apart(a) - apart(b));
    if (start) made.set(start.id, pick.kind);
  }
  return made;
}

/**
 * The game's hours when an event of it was logged: its hours now, less every
 * change to them logged since. The history is read newest first, so every
 * event after one that was read was read too. Null when that can't be told (a
 * total that went to or from nothing since) or comes to no time at all.
 */
function minutesThen(game: GameItem, event: ActivityEvent, events: ActivityEvent[]): number | null {
  let minutes = game.playtime_forever;
  for (const later of events) {
    if (later.game_id !== event.game_id || later.id <= event.id) continue;
    const hours = later.changes.playtime_forever;
    if (!hours) continue;
    const [before, after] = hours;
    if (typeof before !== 'number' || typeof after !== 'number') return null;
    minutes -= after - before;
  }
  return minutes > 0 ? minutes : null;
}

/**
 * The starts a finish was played from, newest first: the game's last start
 * before it, and, where it was paused for another game and picked up again,
 * each start before the pause. The last of them is when it was first started.
 * Empty when the history doesn't go back that far, or the game was finished
 * without being played (moved straight from the backlog).
 */
function startsBefore(finish: ActivityEvent, events: ActivityEvent[]): ActivityEvent[] {
  const earlier = events
    .filter((event) => event.game_id === finish.game_id && event.id < finish.id)
    .sort((a, b) => b.id - a.id);
  const starts: ActivityEvent[] = [];
  for (const event of earlier) {
    const status = event.changes.status;
    if (!status) continue;
    if (status[1] === 'playing') {
      starts.push(event);
      continue;
    }
    const paused =
      status[0] === 'playing' && status[1] === 'backlog' && event.changes.queued?.[1] === true;
    if (!paused) break;
  }
  return starts;
}

/** What a game is now, which its history is read back from. */
interface GameNow {
  playtime_forever: number;
  last_played_at: string | null;
}

/**
 * What a field of a game held just before an event: the value the first
 * change to it, logged at or after the event, changed from, or the value now
 * where nothing has changed it since. Every event of the game since `event`
 * must be in `events`.
 */
function before(
  field: 'playtime_forever' | 'last_played_at',
  now: unknown,
  event: ActivityEvent,
  events: ActivityEvent[],
): unknown {
  const first = events
    .filter((one) => one.game_id === event.game_id && one.id >= event.id && field in one.changes)
    .sort((a, b) => a.id - b.id)[0];
  return first ? first.changes[field][0] : now;
}

/**
 * The start of a finish where how long it took can be told for certain: the
 * game was started, played and finished, with nothing between (no pause, no
 * stop, no drop), and it had never been played before that start (no hours on
 * it, and no last-played date, which a stop or any time played would have
 * stamped). Null for anything else: played some, put down and finished months
 * later doesn't say how long it took, whichever start it is counted from.
 * Shared by Recent activity and the summary a finish opens.
 */
export function cleanStartOf(
  finish: ActivityEvent,
  events: ActivityEvent[],
  game: GameNow,
): ActivityEvent | null {
  const [start] = events
    .filter((one) => one.game_id === finish.game_id && one.id < finish.id && one.changes.status)
    .sort((a, b) => b.id - a.id);
  if (!start || start.changes.status[1] !== 'playing') return null;
  // Played before, as far as the history goes back: paused, stopped or dropped.
  const playedBefore = events.some(
    (one) =>
      one.game_id === finish.game_id && one.id < start.id && one.changes.status?.[0] === 'playing',
  );
  if (playedBefore) return null;
  const hours = before('playtime_forever', game.playtime_forever, start, events);
  if ((hours ?? 0) !== 0) return null;
  return before('last_played_at', game.last_played_at, start, events) == null ? start : null;
}

/** Things done to one game this close together on one day, with nothing else between, are a run. */
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
  if (rating !== null) {
    const was = changes.rating[0];
    return typeof was === 'number'
      ? { kind: 'rerated', rating, from: was }
      : { kind: 'rated', rating };
  }
  if (typeof now('platform') === 'string') return { kind: 'moved', to: now('platform') as string };
  if ('queued' in changes) return { kind: now('queued') === true ? 'queued' : 'unqueued' };
  if ('favorite' in changes) return { kind: now('favorite') === true ? 'favorite' : 'unfavorite' };
  if (now('noted') === true) return { kind: 'note' };
  const [play] = playsOf([event]);
  if (!play) return null;
  // The hours it came to, said only where it was played before: a first go is its own total.
  const total = changes.playtime_forever[1] as number;
  return total > play.minutes
    ? { kind: 'played', minutes: play.minutes, total }
    : { kind: 'played', minutes: play.minutes };
}

/** Newest first, with time played in a row added up into one. */
function updatesOf(newestFirst: Item[]): Item[] {
  const updates: Item[] = [];
  for (const item of [...newestFirst].reverse()) {
    const last = updates.at(-1);
    if (item.line.kind === 'played' && last?.line.kind === 'played') {
      // The newer one's day, moment and total, the older one's key.
      const minutes = (last.line.minutes ?? 0) + (item.line.minutes ?? 0);
      const line: ActivityLine = { ...last.line, minutes };
      if (item.line.total && item.line.total > minutes) line.total = item.line.total;
      else delete line.total;
      updates[updates.length - 1] = { ...item, key: last.key, line };
    } else {
      updates.push(item);
    }
  }
  return updates.reverse();
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
  {
    only,
    picks = [],
    zoneKnown = true,
  }: {
    /** Leaves out every line of another kind, as if it never happened. */
    only?: ReadonlySet<ActivityKind>;
    /** Picks the player pressed Play on, so a start can say it came from one. */
    picks?: PlayedPick[];
    /**
     * False where the player's time zone isn't known (a server, building what
     * other people see): days are then worked out in another zone, a day off
     * either way from theirs.
     */
    zoneKnown?: boolean;
  } = {},
): ActivityEntry[] {
  const shown = new Map(games.filter((game) => game.status !== 'hidden').map((g) => [g.id, g]));

  const pickedBy = startsFromPicks(events, picks);

  const logged = events.flatMap((event): Item[] => {
    const game = shown.get(event.game_id);
    const what = game && told(event);
    if (!game || !what) return [];
    const { day: chosen, rating, ...rest }: Told = what;
    const line: ActivityLine = rest;
    const loggedOn = toLocalIsoDate(new Date(happened(event)));
    // Logged on the day the player gave. Where their zone isn't known, the
    // day before or after counts too: 9pm on the 19th in New York is already
    // the 20th here.
    const thatDay =
      !!chosen && (chosen === loggedOn || (!zoneKnown && withinADay(chosen, loggedOn)));
    // A finish or a drop happened on the day the player says, which can be
    // years before it was logged: that is where it sits in the list, so what
    // is in the past stays there and isn't shown as recent.
    const dated = chosen && !thatDay ? chosen : null;
    if (rating != null) line.rating = rating;
    const picked = line.kind === 'started' ? pickedBy.get(event.id) : undefined;
    if (picked) line.pickedBy = picked;
    // How long it took: its hours as it was finished, not since (played on
    // after, or finished again).
    const took = line.kind === 'finished' ? minutesThen(game, event, events) : null;
    if (took) line.minutes = took;
    if (line.kind === 'finished') {
      // Only where it can be told for certain (see cleanStartOf).
      const start = cleanStartOf(event, events, game);
      if (start) {
        const days = daysApart(toLocalIsoDate(new Date(happened(start))), chosen ?? loggedOn);
        if (days >= 0) line.days = days;
      }
      // Picked up again from a pick is picked as much as a first start from one.
      const from = startsBefore(event, events)
        .map((one) => pickedBy.get(one.id))
        .find(Boolean);
      if (from) line.pickedBy = from;
    }
    return [
      {
        at: dated ?? happened(event),
        order: event.id,
        key: `event-${event.id}`,
        game,
        line,
        day: chosen ?? loggedOn,
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
    if (startOf.get(item.game.id) === item.order) item.line = { ...item.line, kind: 'playing' };
  }

  // What the games themselves say, where the history doesn't: a game being
  // played since before it began, and what was finished or dropped before it.
  const alreadyTold = new Set(
    logged.map((item) => `${item.game.id} ${item.line.kind} ${item.day}`),
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
    // From before the history: its hours now are all there is to go by.
    const took = kind === 'finished' && game.playtime_forever > 0 ? game.playtime_forever : null;
    return from(
      {
        kind,
        ...(game.rating != null ? { rating: game.rating } : {}),
        ...(took ? { minutes: took } : {}),
      },
      day,
      day,
      game.rating,
    );
  });

  const items: Item[] = [...logged, ...before]
    .filter((item) => !only || only.has(item.line.kind))
    .sort((a, b) => b.at.localeCompare(a.at) || b.order - a.order || b.game.id - a.game.id);

  const runs: Item[][] = [];
  for (const item of items) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    const gap = last ? Date.parse(last.at) - Date.parse(item.at) : NaN;
    // Never across days: a group sits under one day, so each of its updates is
    // on the day it shows under.
    const sameGo =
      last && last.game.id === item.game.id && gap <= SAME_GO_MS && last.day === item.day;
    if (run && sameGo) run.push(item);
    else runs.push([item]);
  }

  const made = runs.flatMap((run) => {
    const { game } = run[0];
    const about = {
      id: game.id,
      name: game.name,
      header_image: game.header_image,
      source: game.source,
      platform: game.platform,
    };
    const updates = updatesOf(run).map((item): ActivityEntry => ({
      ...about,
      key: item.key,
      lines: [item.line],
      day: item.day,
      at: item.at,
      rating: item.rating,
    }));
    if (updates.length > SAME_GAME_MORE_THAN) {
      const entry: ActivityEntry = {
        ...about,
        // The run's first update: more done to the game since keeps the row its own.
        key: `updates-${updates.at(-1)!.key}`,
        lines: updates.map((one) => one.lines[0]).reverse(),
        day: updates[0].day,
        at: updates[0].at,
        rating: updates.find((one) => one.rating !== null)?.rating ?? null,
        updates,
      };
      return [{ entry, groupable: false }];
    }
    // One thing done to one game, logged on a day: what a group of games is made
    // of. A game with more done to it in a row stays out of one.
    const [newest] = run;
    const groupable =
      run.length === 1 && newest.at.includes('T') && GROUPABLE.has(newest.line.kind);
    return updates.map((entry) => ({ entry, groupable }));
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
      entries.push({
        ...first,
        key: `bulk-${group.at(-1)!.key}`,
        name: `${group.length} games`,
        // What was done to all of them; each game keeps its own rating.
        lines: [{ kind: first.lines[0].kind }],
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

/** How far back Activity history goes: about six months, in whole weeks. */
export const ACTIVITY_WEEKS = 26;

/**
 * The first day Activity history shows, "YYYY-MM-DD": the Sunday that starts
 * its first week, the week of `today` being its last.
 */
export function activityFrom(today = new Date()): string {
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  first.setDate(first.getDate() - first.getDay() - (ACTIVITY_WEEKS - 1) * 7);
  return toLocalIsoDate(first);
}

/**
 * How many things the player did each day, by "YYYY-MM-DD": the same things
 * other people see on Recent activity (HIGHLIGHTS), each counted on the day it
 * was logged. Hidden games, and games no longer in the library, aren't counted.
 * Days with nothing done aren't in it.
 */
export function activityByDay(games: GameItem[], events: ActivityEvent[]): Record<string, number> {
  const shown = new Set(games.filter((game) => game.status !== 'hidden').map((game) => game.id));
  const days: Record<string, number> = {};
  for (const event of events) {
    if (!shown.has(event.game_id)) continue;
    const what = told(event);
    if (!what || !HIGHLIGHTS.has(what.kind)) continue;
    const day = toLocalIsoDate(new Date(happened(event)));
    days[day] = (days[day] ?? 0) + 1;
  }
  return days;
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

/**
 * When something happened, for the far end of its row: "Just now", "12m ago",
 * "5h ago", "3d ago" within the week, then the day it was ("Nov 10"). A day
 * alone (a finish or a drop the player dated, or one from before the history)
 * is "Today" or so many days ago within the week; '' when nothing says when.
 */
export function activityAgo(at: string, now = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(at)) return '';
  const day = activityDay(at.slice(0, 10), now);
  if (!at.includes('T')) {
    // Whole days between the two dates, whatever the clocks did in between.
    const then = Date.UTC(
      Number(at.slice(0, 4)),
      Number(at.slice(5, 7)) - 1,
      Number(at.slice(8, 10)),
    );
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo = Math.round((today - then) / 86_400_000);
    if (daysAgo === 0) return 'Today';
    return daysAgo > 0 && daysAgo < 7 ? `${daysAgo}d ago` : day;
  }
  const minutes = Math.floor((now.getTime() - Date.parse(at)) / 60_000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : day;
}

/** "45m", "2h" or "2h 30m". */
export function playedFor(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
