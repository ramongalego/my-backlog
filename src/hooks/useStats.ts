'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { loadGamesList, loadOpenEndedCategories, type GameItem } from '@/lib/data/loaders';
import { useAuth } from './useAuth';
import { useQueue } from './useNowPlaying';
import { playedALot } from '@/lib/games/played-a-lot';
import { queryKeys } from '@/lib/query-keys';

export interface TagStat {
  tag: string;
  count: number;
}

export interface TagCompletion {
  tag: string;
  total: number;
  finished: number;
  pct: number;
}

export interface YearStat {
  year: string;
  count: number;
}

export interface RatingBar {
  rating: number;
  count: number;
}

export interface PlayedALotGame {
  id: number;
  app_id: number | null;
  source: string;
  platform: string | null;
  name: string;
  playtime_forever: number;
  main_story_hours: number | null;
  header_image: string | null;
  deck_compat: number | null;
  last_played_at: string | null;
}

/** A game Stats shows with its art. */
export interface StatGame {
  id: number;
  name: string;
  header_image: string | null;
  hours: number;
  rating: number | null;
}

export interface Stats {
  total: number;
  finished: number;
  dropped: number;
  backlog: number;
  finishedPct: number;
  droppedPct: number;
  backlogPct: number;
  totalPlaytimeHours: number;
  totalPlaytimeDays: number;
  estimatedBacklogHours: number;
  topTags: TagStat[];
  tagCompletion: TagCompletion[];
  avgRating: number | null;
  ratedCount: number;
  finishedByYear: YearStat[];
  gamesByReleaseYear: YearStat[];
  ratingDistribution: RatingBar[];
  /** Backlog games played past their story, or open-ended games with many hours. */
  playedALot: PlayedALotGame[];
  /** Games finished in the last 365 days, for the backlog pace estimate. */
  finishedLastYear: number;
  /** Where the hours went: the most played games, most first. */
  mostPlayed: StatGame[];
  /** Finished games rated 9 or 10 (8 and up when there are few), best and newest first. */
  favourites: StatGame[];
  /** Your highest and lowest finish rates among tags with enough games, when they differ. */
  finishContrast: { high: TagCompletion; low: TagCompletion } | null;
}

const MOST_PLAYED = 5;
const FAVOURITES = 8;
// A finish rate over fewer games says more about chance than taste.
const CONTRAST_MIN_GAMES = 8;
const CONTRAST_MIN_GAP = 20;

const statGame = (g: GameItem): StatGame => ({
  id: g.id,
  name: g.name,
  header_image: g.header_image,
  hours: Math.round(g.playtime_forever / 60),
  rating: g.rating,
});

function parseYear(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const m = releaseDate.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

/** Stats leaves out games you've hidden or won't play. */
const countedInStats = (games: GameItem[]) =>
  games.filter((g) => g.status !== 'hidden' && g.status !== 'wont_play');

/**
 * Everything Stats shows, worked out from the library (already without hidden
 * and won't-play games). Null for an empty library.
 */
export function computeStats(
  games: GameItem[],
  categories: Record<number, string[] | null>,
  queuedGameIds: ReadonlySet<number>,
): Stats | null {
  if (games.length === 0) return null;

  const total = games.length;
  const finished = games.filter((g) => g.status === 'finished').length;
  const dropped = games.filter((g) => g.status === 'dropped').length;
  const backlog = total - finished - dropped;

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoIso = yearAgo.toISOString();
  const finishedLastYear = games.filter(
    (g) => g.status === 'finished' && g.finished_at !== null && g.finished_at >= yearAgoIso,
  ).length;

  const rawPlaytimeMins = games.reduce((sum, g) => sum + g.playtime_forever, 0);
  const totalPlaytimeHours = Math.round(rawPlaytimeMins / 60);
  const totalPlaytimeDays = Math.round((rawPlaytimeMins / 60 / 24) * 10) / 10;

  const estimatedBacklogHours = Math.round(
    games
      .filter((g) => !g.status || g.status === 'backlog')
      .reduce((sum, g) => sum + (g.main_story_hours ?? 0), 0),
  );

  // Tags — aggregate across all games
  const EXCLUDED_TAGS = new Set([
    'Singleplayer',
    'Multiplayer',
    'Single-player',
    'Multi-player',
    'Quick-Time Events',
    'Reboot',
  ]);

  const tagCounts = new Map<string, number>();
  const tagFinishedCounts = new Map<string, number>();

  for (const game of games) {
    if (!game.tags) continue;
    for (const tag of game.tags) {
      if (EXCLUDED_TAGS.has(tag)) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      if (game.status === 'finished') {
        tagFinishedCounts.set(tag, (tagFinishedCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  const topTags: TagStat[] = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const tagCompletion: TagCompletion[] = [...tagCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([tag, total]) => {
      const fin = tagFinishedCounts.get(tag) ?? 0;
      return { tag, total, finished: fin, pct: Math.round((fin / total) * 100) };
    })
    .sort((a, b) => b.pct * Math.log(b.total) - a.pct * Math.log(a.total))
    .slice(0, 12);

  // From the tags the grid shows, so the sentence names ones you'd recognise
  // rather than a niche tag with a handful of games.
  const contrastTags = tagCompletion
    .filter((t) => t.total >= CONTRAST_MIN_GAMES)
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
  const high = contrastTags[0];
  const low = contrastTags.at(-1);
  const finishContrast =
    high && low && high.pct - low.pct >= CONTRAST_MIN_GAP ? { high, low } : null;

  const mostPlayed = games
    .filter((g) => g.playtime_forever >= 60)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, MOST_PLAYED)
    .map(statGame);

  // Average rating on finished + rated games
  const ratedGames = games.filter((g) => g.rating !== null && g.status === 'finished');
  const avgRating =
    ratedGames.length > 0
      ? Math.round((ratedGames.reduce((sum, g) => sum + g.rating!, 0) / ratedGames.length) * 10) /
        10
      : null;

  // Rating distribution — finished games only (consistent with avgRating)
  const ratingDistribution: RatingBar[] = Array.from({ length: 11 }, (_, i) => ({
    rating: i,
    count: ratedGames.filter((g) => g.rating === i).length,
  }));

  const byBest = (a: GameItem, b: GameItem) =>
    b.rating! - a.rating! || (b.finished_at ?? '').localeCompare(a.finished_at ?? '');
  const topRated = ratedGames.filter((g) => g.rating! >= 9);
  const favourites = (topRated.length >= 3 ? topRated : ratedGames.filter((g) => g.rating! >= 8))
    .sort(byBest)
    .slice(0, FAVOURITES)
    .map(statGame);

  // Finished by year
  const yearCounts = new Map<string, number>();
  for (const game of games) {
    if (game.finished_at && game.status === 'finished') {
      const year = game.finished_at.slice(0, 4);
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    }
  }
  const finishedByYear: YearStat[] = [...yearCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, count]) => ({ year, count }));

  // Games by release year
  const releaseYearCounts = new Map<string, number>();
  for (const game of games) {
    const year = parseYear(game.release_date);
    if (year) releaseYearCounts.set(year, (releaseYearCounts.get(year) ?? 0) + 1);
  }
  const gamesByReleaseYear: YearStat[] = [...releaseYearCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, count]) => ({ year, count }));

  const playedALotGames: PlayedALotGame[] = playedALot(
    games.map((g) => ({ ...g, categories: categories[g.id] ?? null })),
    queuedGameIds,
  ).map((g) => ({
    id: g.id,
    app_id: g.app_id,
    source: g.source,
    platform: g.platform,
    name: g.name,
    playtime_forever: g.playtime_forever,
    main_story_hours: g.main_story_hours,
    header_image: g.header_image,
    deck_compat: g.deck_compat ?? null,
    last_played_at: g.last_played_at ?? null,
  }));

  // Largest-remainder method so percentages always sum to exactly 100
  const rawPcts = [
    { key: 'backlog' as const, value: (backlog / total) * 100 },
    { key: 'finished' as const, value: (finished / total) * 100 },
    { key: 'dropped' as const, value: (dropped / total) * 100 },
  ];
  const floored = rawPcts.map((p) => ({ ...p, floor: Math.floor(p.value) }));
  let remainder = 100 - floored.reduce((sum, p) => sum + p.floor, 0);
  const byRemainder = [...floored].sort((a, b) => b.value - b.floor - (a.value - a.floor));
  for (const p of byRemainder) {
    if (remainder <= 0) break;
    p.floor++;
    remainder--;
  }
  const pcts = Object.fromEntries(floored.map((p) => [p.key, p.floor])) as Record<
    'backlog' | 'finished' | 'dropped',
    number
  >;

  return {
    finishedLastYear,
    total,
    finished,
    dropped,
    backlog,
    finishedPct: pcts.finished,
    droppedPct: pcts.dropped,
    backlogPct: pcts.backlog,
    totalPlaytimeHours,
    totalPlaytimeDays,
    estimatedBacklogHours,
    topTags,
    tagCompletion,
    avgRating,
    ratedCount: ratedGames.length,
    finishedByYear,
    gamesByReleaseYear,
    ratingDistribution,
    playedALot: playedALotGames,
    mostPlayed,
    favourites,
    finishContrast,
  };
}

/**
 * Nothing to report yet: no game finished, dropped or played, as on a new
 * account. Stats shows what you have and how to start instead of empty
 * sections.
 */
export function isStarting(stats: Stats): boolean {
  return stats.finished === 0 && stats.dropped === 0 && stats.totalPlaytimeHours === 0;
}

export function useStats() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: games = [], isPending } = useQuery({
    // The Games page's list, shared, so the library is downloaded once.
    queryKey: queryKeys.games.list(userId ?? ''),
    queryFn: () => loadGamesList(createClient(), userId!),
    select: countedInStats,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
  const { queuedGameIds } = useQueue(userId);
  // Only "Played a lot" needs categories, and only for heavily played games.
  const { data: categories = {} } = useQuery({
    queryKey: queryKeys.games.openEndedCategories(userId ?? ''),
    queryFn: () => loadOpenEndedCategories(createClient(), userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const stats = computeStats(games, categories, queuedGameIds);

  const hasPlayingGame = games.some((g) => g.status === 'playing');

  return { stats, loading: !!userId && isPending, hasPlayingGame };
}
