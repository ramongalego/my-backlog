import { isSoftware } from '@/lib/games/software';
import { ratingOf } from '@/lib/games/rating';
import {
  multiplayerFocus,
  seriesKey,
  seriesMatch,
  similarity,
  topTags,
} from '@/lib/games/similarity';
import type { EnergyLevel, MoodType, SuggestionPreferences, TimeCommitment } from './types';

/**
 * Scores the backlog in code and hands the model a short, shuffled list.
 *
 * Sending the whole backlog sorted by Steam score made the model pick from the
 * top of the list over and over, left the time filter to it, and buried the
 * strongest signals (a sequel to something you loved) among hundreds of lines.
 * Here the hard rules are applied exactly, the taste signals are computed from
 * your ratings, and the model only chooses between good fits and explains why.
 */

export interface CandidateGame {
  id: number;
  name: string;
  genres: string[] | null;
  categories: string[] | null;
  tags: string[] | null;
  main_story_hours: number | null;
  playtime_forever: number | null;
  steam_review_weighted: number | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  critic_score: number | null;
  critic_count: number | null;
  reroll_count: number | null;
  last_rerolled_at: string | null;
}

export interface HistoryGame {
  name: string;
  status: 'finished' | 'dropped';
  rating: number | null;
  tags: string[] | null;
}

export interface ScoredCandidate<T extends CandidateGame = CandidateGame> {
  game: T;
  score: number;
  /** A finished or dropped game from the same series. */
  series: HistoryGame | null;
  /** Finished games it plays most like, best match first. */
  similarTo: HistoryGame[];
  /** A dropped game it plays a lot like. */
  similarToDropped: HistoryGame | null;
  /** Rerolled within the last few weeks. */
  recentlySkipped: boolean;
  /** Outside the chosen time range; only offered when too few games fit. */
  outsideTimeRange: boolean;
}

// The time ranges the wizard offers, in main-story hours.
export const TIME_RANGES: Record<TimeCommitment, { min: number; max: number }> = {
  short: { min: 0, max: 5 },
  medium: { min: 5, max: 15 },
  long: { min: 15, max: Infinity },
};

// Games built around short runs fit "one session" however long they take to beat.
const SESSION_TAGS = new Set([
  'Roguelike',
  'Roguelite',
  'Action Roguelike',
  'Arcade',
  'Score Attack',
  'Time Attack',
  "Shoot 'Em Up",
  'Card Battler',
]);

const IDLE_TAGS = new Set(['Idler', 'Clicker', 'Incremental']);

interface TagFit {
  likes: string[];
  dislikes: string[];
}

const MOOD_TAGS: Record<MoodType, TagFit> = {
  adrenaline: {
    likes: [
      'Action',
      'Fast-Paced',
      'Shooter',
      'FPS',
      'Third-Person Shooter',
      'Hack and Slash',
      'Souls-like',
      'Difficult',
      'Bullet Hell',
      'Action Roguelike',
      'Roguelike',
      'Roguelite',
      'Fighting',
      '2D Fighter',
      "Beat 'em up",
      'Spectacle fighter',
      'Character Action Game',
      'Precision Platformer',
      'Arcade',
      "Shoot 'Em Up",
      'Twin Stick Shooter',
      'Top-Down Shooter',
      'Arena Shooter',
      'Looter Shooter',
      'Racing',
      'Combat',
      'Parkour',
      'Action RPG',
      'Boss Rush',
    ],
    dislikes: [
      'Relaxing',
      'Cozy',
      'Walking Simulator',
      'Visual Novel',
      'Turn-Based',
      'Turn-Based Combat',
      'Turn-Based Strategy',
      'Turn-Based Tactics',
      'Point & Click',
      'Dating Sim',
      'Life Sim',
      'Farming Sim',
      'Interactive Fiction',
      'Idler',
      'Card Game',
      'Board Game',
      'Grand Strategy',
      'City Builder',
    ],
  },
  relaxed: {
    likes: [
      'Relaxing',
      'Cozy',
      'Casual',
      'Cute',
      'Wholesome',
      'Family Friendly',
      'Farming Sim',
      'Life Sim',
      'Colorful',
      'Exploration',
      'Walking Simulator',
      'Building',
      'Sandbox',
      'Crafting',
      'Puzzle',
      'Hidden Object',
      'Point & Click',
      'Creature Collector',
      'Beautiful',
      'Cartoony',
      'Hand-drawn',
      'Minimalist',
      'Fishing',
    ],
    dislikes: [
      'Difficult',
      'Souls-like',
      'Horror',
      'Psychological Horror',
      'Survival Horror',
      'Gore',
      'Violent',
      'Bullet Hell',
      'Competitive',
      'PvP',
      'Precision Platformer',
      'Perma Death',
      'Fast-Paced',
      'Fighting',
    ],
  },
  engaged: {
    likes: [
      'Strategy',
      'Puzzle',
      'Tactical',
      'Turn-Based Tactics',
      'Turn-Based Strategy',
      'Turn-Based Combat',
      'Turn-Based',
      'Deckbuilding',
      'Card Battler',
      'Management',
      'Resource Management',
      'City Builder',
      'Colony Sim',
      'Automation',
      '4X',
      'Grand Strategy',
      'RTS',
      'Real Time Tactics',
      'Strategy RPG',
      'Tactical RPG',
      'CRPG',
      'Party-Based RPG',
      'Immersive Sim',
      'Stealth',
      'Investigation',
      'Detective',
      'Mystery',
      'Puzzle Platformer',
      'Choices Matter',
      'Economy',
      'Programming',
      'Base Building',
      'Real-Time with Pause',
    ],
    dislikes: ['Walking Simulator', 'Idler', 'Clicker', "Beat 'em up", 'Party Game'],
  },
  emotional: {
    likes: [
      'Story Rich',
      'Emotional',
      'Atmospheric',
      'Choices Matter',
      'Multiple Endings',
      'Cinematic',
      'Drama',
      'Visual Novel',
      'Interactive Fiction',
      'Psychological',
      'Mystery',
      'Lore-Rich',
      'Dynamic Narration',
      'Walking Simulator',
      'Beautiful',
      'Romance',
      'Based On A Novel',
      'Thriller',
      'Detective',
      'Linear',
    ],
    dislikes: [
      'Arcade',
      'Score Attack',
      'Time Attack',
      'Sandbox',
      'PvP',
      'Competitive',
      'Idler',
      'Clicker',
      'Sports',
      'Racing',
      'Fighting',
      'Battle Royale',
      'Procedural Generation',
    ],
  },
};

const DEMANDING = [
  'Grand Strategy',
  '4X',
  'Management',
  'Automation',
  'Colony Sim',
  'City Builder',
  'Resource Management',
  'Economy',
  'Souls-like',
  'Difficult',
  'Turn-Based Tactics',
  'Deckbuilding',
  'RTS',
  'CRPG',
  'Immersive Sim',
  'Precision Platformer',
  'Real Time Tactics',
  'Strategy RPG',
  'Programming',
  'Perma Death',
];

const UNDEMANDING = [
  'Casual',
  'Relaxing',
  'Cozy',
  'Walking Simulator',
  'Visual Novel',
  'Idler',
  'Clicker',
  'Arcade',
  'Short',
  'Point & Click',
  'Interactive Fiction',
  'Hack and Slash',
  "Beat 'em up",
  'Family Friendly',
  'Linear',
  'Hidden Object',
  'Cinematic',
];

const ENERGY_TAGS: Record<EnergyLevel, TagFit> = {
  high: { likes: DEMANDING, dislikes: ['Idler', 'Clicker', 'Walking Simulator', 'Casual'] },
  medium: { likes: [], dislikes: ['Grand Strategy', '4X', 'Idler', 'Clicker'] },
  low: { likes: UNDEMANDING, dislikes: DEMANDING },
};

const WEIGHTS = {
  mood: 2.5,
  energy: 1.5,
  taste: 3,
  series: 3,
  quality: 1.5,
  multiplayerFocus: 2.5,
  idle: 1.5,
  started: 0.3,
  playedOut: 1.5,
  unknownLength: 0.5,
  reroll: 2.5,
};

export const SHORTLIST_SIZE = 20;
// The best matches always make the list; the rest are drawn from the next
// few dozen so repeat visits don't see the same twenty games.
const ALWAYS_INCLUDE = 6;
const DRAW_POOL = 40;
const MIN_TIME_FITS = 3;
const REROLL_HALF_LIFE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const LIKES_MOOD = Object.fromEntries(
  Object.entries(MOOD_TAGS).map(([k, v]) => [
    k,
    { likes: new Set(v.likes), dislikes: new Set(v.dislikes) },
  ]),
) as Record<MoodType, { likes: Set<string>; dislikes: Set<string> }>;
const LIKES_ENERGY = Object.fromEntries(
  Object.entries(ENERGY_TAGS).map(([k, v]) => [
    k,
    { likes: new Set(v.likes), dislikes: new Set(v.dislikes) },
  ]),
) as Record<EnergyLevel, { likes: Set<string>; dislikes: Set<string> }>;

export { isSoftware, seriesKey, seriesMatch };

export function isMultiplayerOnly(game: Pick<CandidateGame, 'categories'>) {
  return !!game.categories?.length && !game.categories.includes('Single-player');
}

function isIdleGame(game: Pick<CandidateGame, 'tags'>) {
  return (game.tags ?? []).slice(0, 3).some((t) => IDLE_TAGS.has(t));
}

function isSessionGame(tags: Map<string, number>) {
  let i = 0;
  for (const tag of tags.keys()) {
    if (i++ >= 8) break;
    if (SESSION_TAGS.has(tag)) return true;
  }
  return false;
}

/** 'fit', 'unknown' (no HLTB time), or how many hours outside the range it is. */
export function timeFit(
  game: Pick<CandidateGame, 'main_story_hours' | 'tags'>,
  time: TimeCommitment,
): 'fit' | 'unknown' | number {
  const tags = topTags(game.tags);
  if (time === 'short' && isSessionGame(tags)) return 'fit';
  const hours = game.main_story_hours;
  if (hours == null || hours <= 0) return 'unknown';
  const { min, max } = TIME_RANGES[time];
  if (hours < min) return min - hours;
  if (hours > max) return hours - max;
  return 'fit';
}

/** How well a game's tags match a set of wanted and unwanted tags, in (-1, 1). */
function tagFit(tags: Map<string, number>, fit: { likes: Set<string>; dislikes: Set<string> }) {
  let sum = 0;
  for (const [tag, w] of tags) {
    if (fit.likes.has(tag)) sum += w;
    else if (fit.dislikes.has(tag)) sum -= w;
  }
  return Math.tanh(sum / 1.5);
}

/** How much a history game says "more like this", from -1 to 1. */
export function historyWeight(game: HistoryGame) {
  if (game.status === 'dropped') return -0.6;
  if (game.rating == null) return 0.3;
  return Math.max(-1, Math.min(1, (game.rating - 6) / 3));
}

function rerollPenalty(game: CandidateGame, now: number) {
  if (!game.last_rerolled_at || !game.reroll_count) return 0;
  const days = (now - new Date(game.last_rerolled_at).getTime()) / DAY_MS;
  if (!(days >= 0)) return 0;
  return Math.min(1, 0.4 * game.reroll_count) * 0.5 ** (days / REROLL_HALF_LIFE_DAYS);
}

export function scoreCandidates<T extends CandidateGame>(
  games: T[],
  history: HistoryGame[],
  preferences: SuggestionPreferences,
  now = Date.now(),
): ScoredCandidate<T>[] {
  const historyTags = history.map((h) => ({
    game: h,
    tags: topTags(h.tags),
    weight: historyWeight(h),
  }));
  const mood = LIKES_MOOD[preferences.mood];
  const energy = LIKES_ENERGY[preferences.energy];

  const scored = games
    .filter((g) => !isMultiplayerOnly(g) && !isSoftware(g))
    .map((game) => {
      const tags = topTags(game.tags);
      const fit = timeFit(game, preferences.time);

      // Taste: a similarity-weighted average of how you felt about the
      // finished and dropped games this one plays most like.
      const matches = historyTags
        .map((h) => ({ ...h, sim: similarity(tags, h.tags) }))
        .filter((h) => h.sim > 0.12)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 5);
      const simSum = matches.reduce((s, m) => s + m.sim, 0);
      const taste =
        simSum > 0 ? matches.reduce((s, m) => s + m.weight * m.sim * m.sim, 0) / simSum : 0;

      // Series: the strongest feeling about a related game you've played.
      let series: HistoryGame | null = null;
      let seriesScore = 0;
      for (const h of historyTags) {
        const match = seriesMatch(game.name, h.game.name);
        // A shared first word isn't enough on its own ("Portal" and "Portal Knights").
        if (!match || (match < 1 && similarity(tags, h.tags) < 0.2)) continue;
        const value = match * h.weight;
        if (Math.abs(value) > Math.abs(seriesScore)) {
          seriesScore = value;
          series = h.game;
        }
      }

      const hoursPlayed = (game.playtime_forever ?? 0) / 60;
      const length = game.main_story_hours;
      const playedOut = length ? hoursPlayed >= Math.max(3, length * 1.2) : hoursPlayed >= 40;
      const started = !playedOut && hoursPlayed >= 0.5;
      const rating = ratingOf(game);
      const quality = rating == null ? 0.3 : Math.max(0, Math.min(1, (rating - 50) / 45));
      const reroll = rerollPenalty(game, now);

      const score =
        WEIGHTS.mood * tagFit(tags, mood) +
        WEIGHTS.energy * tagFit(tags, energy) +
        WEIGHTS.taste * taste +
        WEIGHTS.series * seriesScore +
        WEIGHTS.quality * quality -
        WEIGHTS.multiplayerFocus * multiplayerFocus(game) -
        (preferences.energy !== 'low' && isIdleGame(game) ? WEIGHTS.idle : 0) +
        (started ? WEIGHTS.started : 0) -
        (playedOut ? WEIGHTS.playedOut : 0) -
        (fit === 'unknown' ? WEIGHTS.unknownLength : 0) -
        WEIGHTS.reroll * reroll;

      return {
        candidate: {
          game,
          score,
          series,
          similarTo: matches
            .filter(
              (m) =>
                m.game !== series && m.game.status === 'finished' && m.weight > 0 && m.sim >= 0.3,
            )
            .slice(0, 2)
            .map((m) => m.game),
          similarToDropped:
            matches.find((m) => m.game.status === 'dropped' && m.sim >= 0.35)?.game ?? null,
          recentlySkipped: reroll > 0.2,
          outsideTimeRange: typeof fit === 'number',
        } satisfies ScoredCandidate<T>,
        distance: typeof fit === 'number' ? fit : 0,
      };
    });

  // Keep only games that fit the time you have, unless almost nothing does:
  // then the closest few in length come along too.
  const fits = scored.filter((s) => s.distance === 0);
  const nearest =
    fits.length >= MIN_TIME_FITS
      ? []
      : scored
          .filter((s) => s.distance > 0)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, MIN_TIME_FITS - fits.length);

  return [...fits, ...nearest].map((s) => s.candidate).sort((a, b) => b.score - a.score);
}

/**
 * The best few matches, plus a draw from the next ones weighted by score,
 * shuffled so the model can't lean on list order.
 */
export function pickShortlist<T extends CandidateGame>(
  ranked: ScoredCandidate<T>[],
  random: () => number = Math.random,
  size = SHORTLIST_SIZE,
): ScoredCandidate<T>[] {
  const picked = ranked.slice(0, Math.min(ALWAYS_INCLUDE, size));
  const pool = ranked.slice(picked.length, picked.length + DRAW_POOL);
  const best = pool[0]?.score ?? 0;
  const weights = pool.map((c) => Math.exp(c.score - best));

  while (picked.length < size && pool.length > 0) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = random() * total;
    let i = 0;
    while (i < weights.length - 1 && r >= weights[i]) r -= weights[i++];
    picked.push(pool[i]);
    pool.splice(i, 1);
    weights.splice(i, 1);
  }

  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}
