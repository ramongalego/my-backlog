import type { GameWithImage } from '@/types/games';
import {
  SHORT_GAME_MAX_HOURS,
  SHORT_GAME_MIN_HOURS,
  WEEKEND_GAME_MAX_HOURS,
  MAX_PLAYTIME_MINUTES,
} from './filtering';
import { editionKey, multiplayerFocus, seriesMatch, similarity, topTags } from './similarity';

/** A backlog game with what the carousels sort and filter on. */
export interface CarouselGame extends GameWithImage {
  steam_review_weighted: number | null;
  tags: string[] | null;
  categories: string[] | null;
  created_at: string;
}

/** A finished game rated 8 or higher, the seed for "More Like ...". */
export interface LovedGame {
  name: string;
  rating: number;
  tags: string[] | null;
  finished_at: string | null;
}

export interface CarouselPools {
  pickUpPool: CarouselGame[];
  moreLike: { basedOn: string; games: CarouselGame[] } | null;
  shortGamesPool: CarouselGame[];
  weekendGamesPool: CarouselGame[];
  highlyRatedGamesPool: CarouselGame[];
  hiddenGemsPool: CarouselGame[];
  recentlyAddedPool: CarouselGame[];
}

export const EMPTY_CAROUSEL_POOLS: CarouselPools = {
  pickUpPool: [],
  moreLike: null,
  shortGamesPool: [],
  weekendGamesPool: [],
  highlyRatedGamesPool: [],
  hiddenGemsPool: [],
  recentlyAddedPool: [],
};

const POOL_SIZE = 20;

// Played this much of the main story and it's probably finished, whatever
// the status says.
const PLAYED_OUT_SHARE = 0.8;

// Pick Up Where You Left Off: at least an hour in, and far enough that it
// was more than a quick look.
const STARTED_MIN_MINUTES = 60;
const STARTED_MIN_SHARE = 0.1;
// Without an HLTB time there's no share, so ask for a bit more playtime.
const STARTED_MIN_MINUTES_UNKNOWN_LENGTH = 120;

// Hidden Gems: loved by the people who played them, but far fewer people than
// the big hits. Enough reviews that the score means something.
const GEM_MIN_SCORE = 90;
const GEM_MIN_REVIEWS = 50;
const GEM_MAX_REVIEWS = 5000;

// Best score first; on a tie, the less-known game. (The weighted score would
// put the most-reviewed, least hidden games first.)
const byGemRank = (a: CarouselGame, b: CarouselGame) =>
  (b.steam_review_score ?? 0) - (a.steam_review_score ?? 0) ||
  (a.steam_review_count ?? 0) - (b.steam_review_count ?? 0) ||
  a.app_id - b.app_id;

// More Like ...: how close a backlog game must be to the loved game, and how
// many it needs before the carousel is worth showing.
const MORE_LIKE_MIN_RATING = 8;
const MORE_LIKE_MIN_SIMILARITY = 0.25;
const MORE_LIKE_MIN_STEAM_SCORE = 75;
export const MORE_LIKE_MIN_GAMES = 3;
const SAME_SERIES_BONUS = 0.5;

// Two or more of the top tags about playing with others: listed as
// single-player, but built around multiplayer (ARK, Vermintide, Pummel Party).
const MULTIPLAYER_FIRST = 0.6;

// A fighting game's HLTB time is its story mode, not the game, so it doesn't
// belong in the "finish it in N hours" carousels.
const FIGHTING_TAGS = new Set(['Fighting', '2D Fighter', '3D Fighter', 'Arena Fighter']);

const FIRST_SYNC_WINDOW_MS = 60 * 60 * 1000;

function isPlayedOut(g: CarouselGame) {
  return !!g.main_story_hours && g.playtime_forever / 60 >= g.main_story_hours * PLAYED_OUT_SHARE;
}

function isFighting(g: CarouselGame) {
  return (g.tags ?? []).slice(0, 3).some((t) => FIGHTING_TAGS.has(t));
}

function progress(g: CarouselGame) {
  return g.main_story_hours ? g.playtime_forever / 60 / g.main_story_hours : 0;
}

function isStarted(g: CarouselGame) {
  if (g.playtime_forever < STARTED_MIN_MINUTES || isPlayedOut(g)) return false;
  return g.main_story_hours
    ? progress(g) >= STARTED_MIN_SHARE
    : g.playtime_forever >= STARTED_MIN_MINUTES_UNKNOWN_LENGTH;
}

const byWeighted = (a: CarouselGame, b: CarouselGame) =>
  (b.steam_review_weighted ?? -1) - (a.steam_review_weighted ?? -1) || a.app_id - b.app_id;

/** One game per edition: the better-reviewed of "Ori" and "Ori: Definitive Edition". */
function oneEditionEach(games: CarouselGame[]) {
  const best = new Map<string, CarouselGame>();
  for (const g of games) {
    const key = editionKey(g.name) || String(g.app_id);
    const kept = best.get(key);
    if (!kept || byWeighted(g, kept) < 0) best.set(key, g);
  }
  const keep = new Set(best.values());
  return games.filter((g) => keep.has(g));
}

/**
 * The best-loved game (highest rated, then most recently finished) with enough
 * well-reviewed backlog games that play like it. Same-series games rank first.
 */
function moreLike(games: CarouselGame[], loved: LovedGame[]): CarouselPools['moreLike'] {
  const seeds = [...loved]
    .filter((g) => g.rating >= MORE_LIKE_MIN_RATING)
    .sort(
      (a, b) => b.rating - a.rating || (b.finished_at ?? '').localeCompare(a.finished_at ?? ''),
    );
  const worthPlaying = games.filter(
    (g) => (g.steam_review_score ?? 0) >= MORE_LIKE_MIN_STEAM_SCORE,
  );

  for (const seed of seeds) {
    const seedTags = topTags(seed.tags);
    const matches = worthPlaying
      .map((game) => ({
        game,
        score:
          similarity(topTags(game.tags), seedTags) +
          (seriesMatch(game.name, seed.name) === 1 ? SAME_SERIES_BONUS : 0),
      }))
      .filter((m) => m.score >= MORE_LIKE_MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score || byWeighted(a.game, b.game));
    if (matches.length >= MORE_LIKE_MIN_GAMES) {
      return { basedOn: seed.name, games: matches.slice(0, POOL_SIZE).map((m) => m.game) };
    }
  }
  return null;
}

/** Games that arrived after the first import (Steam doesn't expose purchase dates). */
function addedSinceFirstSync(games: CarouselGame[], firstImportedAt: string | undefined) {
  if (!firstImportedAt) return [];
  const cutoff = Date.parse(firstImportedAt) + FIRST_SYNC_WINDOW_MS;
  return games
    .filter((g) => Date.parse(g.created_at) > cutoff)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.app_id - a.app_id)
    .slice(0, POOL_SIZE);
}

/**
 * Builds every Home carousel from the backlog (status backlog or none, type
 * game), the user's loved games and their queue. Each pool is ranked; useCarouselPools
 * trims them and keeps a game out of more than one carousel.
 */
export function buildCarouselPools(
  backlog: CarouselGame[],
  loved: LovedGame[],
  firstImportedAt: string | undefined,
  queuedAppIds: ReadonlySet<number> = new Set(),
): CarouselPools {
  // Queued games are already decided, so they aren't suggested again.
  const candidates = oneEditionEach(
    backlog.filter(
      (g) =>
        !queuedAppIds.has(g.app_id) &&
        g.categories?.includes('Single-player') &&
        multiplayerFocus({ categories: g.categories, tags: g.tags }) < MULTIPLAYER_FIRST,
    ),
  );
  const unfinished = candidates.filter((g) => !isPlayedOut(g));
  const reviewed = unfinished.filter((g) => g.steam_review_weighted != null).sort(byWeighted);

  const lengthBetween = (min: number, max: number, minInclusive: boolean) =>
    reviewed.filter(
      (g) =>
        g.main_story_hours != null &&
        (minInclusive ? g.main_story_hours >= min : g.main_story_hours > min) &&
        g.main_story_hours <= max &&
        g.playtime_forever <= MAX_PLAYTIME_MINUTES &&
        !isFighting(g),
    );

  return {
    pickUpPool: candidates
      .filter(isStarted)
      .sort((a, b) => progress(b) - progress(a) || b.playtime_forever - a.playtime_forever)
      .slice(0, POOL_SIZE),
    moreLike: moreLike(unfinished, loved),
    shortGamesPool: lengthBetween(SHORT_GAME_MIN_HOURS, SHORT_GAME_MAX_HOURS, true),
    weekendGamesPool: lengthBetween(SHORT_GAME_MAX_HOURS, WEEKEND_GAME_MAX_HOURS, false),
    highlyRatedGamesPool: reviewed.filter((g) => g.playtime_forever === 0).slice(0, POOL_SIZE),
    hiddenGemsPool: reviewed
      .filter(
        (g) =>
          (g.steam_review_score ?? 0) >= GEM_MIN_SCORE &&
          (g.steam_review_count ?? 0) >= GEM_MIN_REVIEWS &&
          (g.steam_review_count ?? 0) <= GEM_MAX_REVIEWS,
      )
      .sort(byGemRank)
      .slice(0, POOL_SIZE),
    // A factual list of new arrivals, so it isn't filtered like the picks.
    recentlyAddedPool: addedSinceFirstSync(backlog, firstImportedAt),
  };
}
