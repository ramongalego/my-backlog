// What a library says about the player, worked out in code: the facts the
// Profile and Roast tabs on Stats are written from. The model only writes
// them up, so everything it says is true of the library.
import type { GameItem } from '@/lib/data/loaders';
import { consoleOf } from '@/lib/games/consoles';
import { computeStats, countedInStats } from '@/lib/stats/compute';

/** A game as the profile mentions it. */
interface NamedHours {
  name: string;
  hours: number;
}

export interface PlayerFacts {
  libraryGames: number;
  totalHours: number;
  /** Consoles the player adds games from, most games first ("PC" for Steam). */
  platforms: { platform: string; games: number }[];
  backlog: { games: number; storyHours: number; neverStarted: number };
  finished: number;
  dropped: number;
  finishedLastYear: number;
  /** Of the games they finished or dropped, the share they finished. */
  finishRatePct: number | null;
  /** Backlog games they put real time into without finishing. */
  startedNotFinished: NamedHours[];
  /** Dropped after putting real time in. */
  droppedLate: NamedHours[];
  /** Dropped almost straight away. */
  droppedEarly: number;
  mostPlayed: NamedHours[];
  topTags: { tag: string; games: number }[];
  finishesMost: { tag: string; pct: number }[];
  finishesLeast: { tag: string; pct: number }[];
  ratings: {
    count: number;
    average: number | null;
    favourites: string[];
    lowest: { name: string; rating: number }[];
  };
  /** Median time to beat of what they finish, against what waits in the backlog. */
  storyHoursMedian: { finished: number | null; backlog: number | null };
  playingNow: string | null;
  wontPlay: number;
}

const hours = (minutes: number) => Math.round(minutes / 60);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value);
}

// Enough to say something specific about a player, by either route: a
// history in the app (finished and dropped games, some of them rated), or,
// for a Steam library new to the app, enough real play.
const MIN_ENDED = 5;
const MIN_RATED = 3;
const MIN_PLAYED_GAMES = 10;
const PLAYED_MINUTES = 120;

/**
 * Whether the library says enough for a profile. Below this the section isn't
 * shown at all, rather than asking for more.
 */
export function hasEnoughForProfile(games: GameItem[]): boolean {
  const counted = countedInStats(games);
  const ended = counted.filter((g) => g.status === 'finished' || g.status === 'dropped').length;
  const rated = counted.filter((g) => g.rating != null).length;
  const played = counted.filter((g) => g.playtime_forever >= PLAYED_MINUTES).length;
  return (ended >= MIN_ENDED && rated >= MIN_RATED) || played >= MIN_PLAYED_GAMES;
}

const isBacklog = (g: GameItem) => g.status === 'backlog' || g.status === 'playing' || !g.status;

/** The facts about a player, from their whole library. */
export function playerFacts(games: GameItem[]): PlayerFacts | null {
  const counted = countedInStats(games);
  const stats = computeStats(counted, {}, new Set());
  if (!stats) return null;

  const finishedGames = counted.filter((g) => g.status === 'finished');
  const droppedGames = counted.filter((g) => g.status === 'dropped');
  const backlogGames = counted.filter(isBacklog);
  const ended = finishedGames.length + droppedGames.length;

  const platformCounts = new Map<string, number>();
  for (const g of counted) {
    const platform = consoleOf(g) ?? 'PC';
    platformCounts.set(platform, (platformCounts.get(platform) ?? 0) + 1);
  }

  const rated = counted.filter((g) => g.rating != null && g.status === 'finished');
  const byHours = (a: GameItem, b: GameItem) => b.playtime_forever - a.playtime_forever;
  const named = (g: GameItem): NamedHours => ({ name: g.name, hours: hours(g.playtime_forever) });
  const storyHours = (list: GameItem[]) =>
    list.map((g) => g.main_story_hours).filter((h): h is number => h != null && h > 0);

  return {
    libraryGames: stats.total,
    totalHours: stats.totalPlaytimeHours,
    platforms: [...platformCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([platform, count]) => ({ platform, games: count })),
    backlog: {
      games: stats.backlog,
      storyHours: stats.estimatedBacklogHours,
      neverStarted: backlogGames.filter((g) => g.playtime_forever < 30).length,
    },
    finished: stats.finished,
    dropped: stats.dropped,
    finishedLastYear: stats.finishedLastYear,
    finishRatePct: ended ? Math.round((finishedGames.length / ended) * 100) : null,
    startedNotFinished: backlogGames
      .filter((g) => g.playtime_forever >= 3 * 60)
      .sort(byHours)
      .slice(0, 5)
      .map(named),
    droppedLate: droppedGames
      .filter((g) => g.playtime_forever >= 10 * 60)
      .sort(byHours)
      .slice(0, 5)
      .map(named),
    droppedEarly: droppedGames.filter((g) => g.playtime_forever < 2 * 60).length,
    mostPlayed: stats.mostPlayed.map((g) => ({ name: g.name, hours: g.hours })),
    topTags: stats.topTags.slice(0, 8).map((t) => ({ tag: t.tag, games: t.count })),
    finishesMost: [...stats.tagCompletion]
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
      .map((t) => ({ tag: t.tag, pct: t.pct })),
    finishesLeast: [...stats.tagCompletion]
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3)
      .map((t) => ({ tag: t.tag, pct: t.pct })),
    ratings: {
      count: rated.length,
      average: stats.avgRating,
      favourites: stats.favourites.slice(0, 6).map((g) => g.name),
      lowest: [...rated]
        .sort((a, b) => a.rating! - b.rating!)
        .filter((g) => g.rating! <= 6)
        .slice(0, 3)
        .map((g) => ({ name: g.name, rating: g.rating! })),
    },
    storyHoursMedian: {
      finished: median(storyHours(finishedGames)),
      backlog: median(storyHours(backlogGames)),
    },
    playingNow: counted.find((g) => g.status === 'playing')?.name ?? null,
    wontPlay: games.filter((g) => g.status === 'wont_play').length,
  };
}

/**
 * What a written profile depends on. It's written again only when one of
 * these changes (a game finished, dropped or rated, or the library grows by
 * ten), not for every hour played.
 */
export function factsSignature(facts: PlayerFacts): string {
  return [
    facts.finished,
    facts.dropped,
    facts.ratings.count,
    facts.ratings.average ?? '-',
    facts.wontPlay,
    Math.floor(facts.libraryGames / 10),
    facts.playingNow ?? '-',
  ].join(':');
}
