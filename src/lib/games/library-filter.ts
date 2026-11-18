import type { GameItem } from '@/lib/data/loaders';
import { parseReleaseDate } from './release-date';
import { ratingOf } from './rating';
import { matchesSearch, nameMatchesSearch } from './search';
import { platformOf } from './consoles';

export const GAME_FILTERS = [
  'all',
  'backlog',
  'finished',
  'dropped',
  'wont_play',
  'hidden',
] as const;
export const GAME_SORTS = ['playtime', 'score', 'rating', 'recent', 'released', 'length'] as const;
export type GameFilter = (typeof GAME_FILTERS)[number];
export type GameSort = (typeof GAME_SORTS)[number];
export type FilterCounts = Record<GameFilter, number>;

/** How each sort reads in its usual order, then reversed. */
export const SORT_DIRECTIONS: Record<GameSort, [string, string]> = {
  score: ['Highest first', 'Lowest first'],
  rating: ['Highest first', 'Lowest first'],
  recent: ['Newest first', 'Oldest first'],
  released: ['Newest first', 'Oldest first'],
  playtime: ['Most first', 'Least first'],
  length: ['Shortest first', 'Longest first'],
};

/** Only Time to beat runs smallest first unless reversed. */
export function sortsAscending(sort: GameSort, reversed: boolean): boolean {
  return (sort === 'length') !== reversed;
}

// Parsed once per row: a sort compares each game many times, and parsing
// dominated sorting a big library. Refetched or patched rows are new objects.
const releaseTimes = new WeakMap<GameItem, number>();
function releaseTime(game: GameItem): number {
  let time = releaseTimes.get(game);
  if (time === undefined) {
    time = parseReleaseDate(game.release_date) ?? -Infinity;
    releaseTimes.set(game, time);
  }
  return time;
}

// Ratings only mean something on finished or dropped games. Some older rows
// kept a rating after moving back to the backlog, so those count as unrated.
function myRating(game: GameItem): number {
  const rated = game.status === 'finished' || game.status === 'dropped';
  return rated && game.rating != null ? game.rating : -1;
}

function compareGames(a: GameItem, b: GameItem, sort: GameSort): number {
  switch (sort) {
    case 'score':
      // Critic score, else Steam's weighted score (ratingOf), as the cards show.
      return (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0);
    case 'rating':
      // Ties: most recently finished first, then by score.
      return (
        myRating(b) - myRating(a) ||
        (b.finished_at ?? '').localeCompare(a.finished_at ?? '') ||
        (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0)
      );
    case 'recent':
      // When the game joined the library. The first sync imports everything
      // at once, so ties fall back to the newest on Steam.
      return (
        b.created_at.localeCompare(a.created_at) || (b.app_id ?? 0) - (a.app_id ?? 0) || b.id - a.id
      );
    case 'released':
      return releaseTime(b) - releaseTime(a) || b.id - a.id;
    case 'length': {
      const aHours = a.main_story_hours ?? Infinity;
      const bHours = b.main_story_hours ?? Infinity;
      return aHours - bHours;
    }
    case 'playtime':
    default:
      return b.playtime_forever - a.playtime_forever;
  }
}

// Games without the value go last either way: reversing a sort shouldn't bring
// every unknown to the top.
function hasSortValue(game: GameItem, sort: GameSort): boolean {
  switch (sort) {
    case 'score':
      return ratingOf(game) !== null;
    case 'rating':
      return myRating(game) >= 0;
    case 'released':
      return releaseTime(game) !== -Infinity;
    case 'length':
      return game.main_story_hours != null;
    default:
      return true;
  }
}

function orderGames(a: GameItem, b: GameItem, sort: GameSort, reversed: boolean): number {
  const aHas = hasSortValue(a, sort);
  if (aHas !== hasSortValue(b, sort)) return aHas ? -1 : 1;
  const order = compareGames(a, b, sort);
  return reversed ? -order : order;
}

export function searchLibrary(games: GameItem[], query: string): GameItem[] {
  if (!query) return games;
  return games.filter((game) => matchesSearch(game, query));
}

function inFilter(game: GameItem, filter: GameFilter): boolean {
  if (filter === 'all') return game.status !== 'hidden';
  if (filter === 'backlog') return game.status === 'backlog' || game.status === 'playing';
  return game.status === filter;
}

/** Counted over the whole library, so the list doesn't reorder on search or filter. */
export function libraryPlatforms(games: GameItem[]): string[] {
  const totals = new Map<string, number>();
  for (const game of games) {
    const platform = platformOf(game);
    if (platform) totals.set(platform, (totals.get(platform) ?? 0) + 1);
  }
  return [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)! || a.localeCompare(b));
}

export function onPlatform(games: GameItem[], platform: string): GameItem[] {
  if (!platform) return games;
  return games.filter((game) => platformOf(game) === platform);
}

/** What picking each platform would show under the current filter and search. */
export function countPlatforms(searched: GameItem[], filter: GameFilter): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of searched) {
    const platform = platformOf(game);
    if (platform && inFilter(game, filter)) counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return counts;
}

/**
 * All leaves out only hidden games (won't-play games are still the library).
 * Backlog includes the game being played. A search lists name matches before
 * games only tagged with it.
 */
export function filterLibrary(
  searched: GameItem[],
  filter: GameFilter,
  sort: GameSort,
  query = '',
  /** The other way from the sort's usual order. */
  reversed = false,
): GameItem[] {
  const filtered = searched.filter((game) => inFilter(game, filter));

  if (!query) return filtered.sort((a, b) => orderGames(a, b, sort, reversed));
  const named = new Set(filtered.filter((g) => nameMatchesSearch(g, query)).map((g) => g.id));
  return filtered.sort(
    (a, b) => Number(named.has(b.id)) - Number(named.has(a.id)) || orderGames(a, b, sort, reversed),
  );
}

export function countLibrary(searched: GameItem[]): FilterCounts {
  const counts = { all: 0, backlog: 0, finished: 0, dropped: 0, wont_play: 0, hidden: 0 };
  for (const game of searched) {
    if (game.status === 'hidden') {
      counts.hidden++;
      continue;
    }
    counts.all++;
    // The game being played counts under Backlog, where it's listed.
    counts[game.status === 'playing' ? 'backlog' : game.status]++;
  }
  return counts;
}
