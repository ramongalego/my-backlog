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
  /** Null when no game has hours recorded (a library added by hand). */
  totalHours: number | null;
  /** Consoles the player adds games from, most games first ("PC" for Steam). */
  platforms: { platform: string; games: number }[];
  /** neverStarted counts Steam games only: it's null without Steam. */
  backlog: { games: number; storyHours: number; neverStarted: number | null };
  finished: number;
  dropped: number;
  finishedLastYear: number;
  /** Of the games they finished or dropped, the share they finished. */
  finishRatePct: number | null;
  /** Backlog games they put real time into without finishing. */
  startedNotFinished: NamedHours[];
  /** Dropped after putting real time in. */
  droppedLate: NamedHours[];
  /** Dropped almost straight away (only games whose hours are known). */
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
  /**
   * What they love, against what they own: the tags of the games they rated
   * 8 or more, and the decades those games came out in.
   */
  loved: {
    tags: { tag: string; games: number }[];
    decades: { decade: string; games: number }[];
  };
  /** Games they rated well above or below the critics. */
  critics: {
    ratedAbove: CriticGap[];
    ratedBelow: CriticGap[];
  };
  /** The share of all their hours that went into their most played game. */
  topGameSharePct: number | null;
  /**
   * How their Steam games were (not) played, for the roast. Steam only:
   * games added by hand often have no hours recorded.
   */
  steam: {
    games: number;
    neverLaunched: number;
    neverLaunchedPct: number;
    underAnHour: number;
    /** Stopped between 90 and 120 minutes, just inside Steam's refund window. */
    refundWindow: number;
    /** Opened for 15 minutes or less and never again. */
    openedOnce: NamedMinutes[];
  } | null;
}

interface CriticGap {
  name: string;
  /** Their rating out of 10. */
  yours: number;
  /** The critics' average out of 100. */
  critics: number;
}

interface NamedMinutes {
  name: string;
  minutes: number;
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

// Steam records every game's hours. A game added by hand only has hours if
// the player entered them, so a 0 there means unknown, not unplayed.
const hoursKnown = (g: GameItem) => g.source === 'steam' || g.playtime_forever > 0;

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
  const byPlaytime = [...counted].sort(byHours);
  const totalMinutes = counted.reduce((sum, g) => sum + g.playtime_forever, 0);
  const storyHours = (list: GameItem[]) =>
    list.map((g) => g.main_story_hours).filter((h): h is number => h != null && h > 0);

  return {
    libraryGames: stats.total,
    totalHours: totalMinutes > 0 ? stats.totalPlaytimeHours : null,
    platforms: [...platformCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([platform, count]) => ({ platform, games: count })),
    backlog: {
      games: stats.backlog,
      storyHours: stats.estimatedBacklogHours,
      neverStarted: counted.some((g) => g.source === 'steam')
        ? backlogGames.filter((g) => g.source === 'steam' && g.playtime_forever < 30).length
        : null,
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
    droppedEarly: droppedGames.filter((g) => hoursKnown(g) && g.playtime_forever < 2 * 60).length,
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
    topGameSharePct:
      totalMinutes > 0 && byPlaytime[0]
        ? Math.round((byPlaytime[0].playtime_forever / totalMinutes) * 100)
        : null,
    loved: lovedFacts(counted),
    critics: criticGaps(counted),
    steam: steamFacts(counted),
  };
}

const LOVED_RATING = 8;
// A gap of 2 points out of 10 is a real disagreement, not rounding.
const CRITIC_GAP = 20;

function topCounts(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function lovedFacts(counted: GameItem[]): PlayerFacts['loved'] {
  const loved = counted.filter((g) => g.rating != null && g.rating >= LOVED_RATING);
  const decades = loved
    .map((g) => g.release_date?.match(/\b(19|20)\d{2}\b/)?.[0])
    .filter((year): year is string => !!year)
    .map((year) => `${year.slice(0, 3)}0s`);
  return {
    tags: topCounts(
      loved.flatMap((g) => g.tags ?? []),
      6,
    ).map(([tag, games]) => ({ tag, games })),
    decades: topCounts(decades, 3).map(([decade, games]) => ({ decade, games })),
  };
}

function criticGaps(counted: GameItem[]): PlayerFacts['critics'] {
  const gaps = counted
    .filter((g) => g.rating != null && g.critic_score != null)
    .map((g) => ({
      name: g.name,
      yours: g.rating!,
      critics: Math.round(g.critic_score!),
      gap: g.rating! * 10 - g.critic_score!,
    }))
    .filter((g) => Math.abs(g.gap) >= CRITIC_GAP);
  const pick = (list: typeof gaps) =>
    list.slice(0, 3).map(({ name, yours, critics }) => ({ name, yours, critics }));
  return {
    ratedAbove: pick(gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap)),
    ratedBelow: pick(gaps.filter((g) => g.gap < 0).sort((a, b) => a.gap - b.gap)),
  };
}

function steamFacts(counted: GameItem[]): PlayerFacts['steam'] {
  const steam = counted.filter((g) => g.source === 'steam');
  if (steam.length === 0) return null;
  const neverLaunched = steam.filter((g) => g.playtime_forever === 0).length;
  return {
    games: steam.length,
    neverLaunched,
    neverLaunchedPct: Math.round((neverLaunched / steam.length) * 100),
    underAnHour: steam.filter((g) => g.playtime_forever > 0 && g.playtime_forever < 60).length,
    refundWindow: steam.filter((g) => g.playtime_forever >= 90 && g.playtime_forever <= 120).length,
    openedOnce: steam
      .filter((g) => g.playtime_forever > 0 && g.playtime_forever <= 15 && g.status !== 'finished')
      .slice(0, 5)
      .map((g) => ({ name: g.name, minutes: g.playtime_forever })),
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
