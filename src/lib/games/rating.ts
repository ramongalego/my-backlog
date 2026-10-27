// How a game rates, the same way for Steam games and games added by hand.

/** Fewer reviews than this and one critic's score would stand for the game. */
export const MIN_CRITIC_REVIEWS = 3;

interface CriticScored {
  critic_score?: number | null;
  critic_count?: number | null;
}

/** The game's critic score (0-100), if enough critics reviewed it. */
export function criticScoreOf(game: CriticScored): number | null {
  return game.critic_score != null && (game.critic_count ?? 0) >= MIN_CRITIC_REVIEWS
    ? game.critic_score
    : null;
}

// Steam's percent positive runs higher than critics' scores for the same game,
// most of all near the top (95% on Steam is about 88 from critics), so a game
// with only Steam reviews would outrank better-reviewed games. These points
// convert one scale to the other by rank: the Steam score of the game at a
// given percentile matched to the critic score at the same percentile, among
// 143 games with plenty of both (October 2026). In between, it's linear.
const STEAM_TO_CRITIC: [steam: number, critic: number][] = [
  [0, 0],
  [70, 67],
  [80, 76],
  [85, 79],
  [90, 82],
  [92, 83],
  [94, 86],
  [95, 88],
  [96, 90],
  [97, 92],
  [98, 94],
  [100, 96],
];

// How much a Steam score is trusted grows with its review count: it's read as
// if it came with this many more reviews at the average (70%). Statistically a
// few hundred would do, but this many also rewards breadth: a game 96% of
// 220,000 people liked ranks above one 98% of 12,000 did. Small games pay for
// it here (93% of 3,000 reads as 84); Hidden Gems, ranked by the raw score
// among small games, is where they shine instead.
const STEAM_PRIOR_REVIEWS = 2000;
const STEAM_AVERAGE = 70;

/** Steam's percent positive, weighted by how many reviews it's from. */
export function weightedSteamScore(score: number, count: number): number {
  return (count * score + STEAM_PRIOR_REVIEWS * STEAM_AVERAGE) / (count + STEAM_PRIOR_REVIEWS);
}

/** A Steam review score (weighted) on the critic score's scale. */
export function steamOnCriticScale(steam: number): number {
  const upper = STEAM_TO_CRITIC.findIndex(([s]) => s >= steam);
  if (upper <= 0) return STEAM_TO_CRITIC[Math.max(upper, 0)][1];
  const [s0, c0] = STEAM_TO_CRITIC[upper - 1];
  const [s1, c1] = STEAM_TO_CRITIC[upper];
  return c0 + ((steam - s0) / (s1 - s0)) * (c1 - c0);
}

// Critics and players agree only partly: across the same 143 games, the two
// scores (on one scale) correlate at about 0.5, around an average of 81. So for
// a game rated by one side only, the other side's likely score is halfway
// between this one and the average, and their average keeps three-quarters of
// this score's distance from it. Without that, one glowing score would outrank
// two that mostly agree (Portal, Steam only, above Baldur's Gate 3).
const AVERAGE_RATING = 81;
const ONE_SIDE_WEIGHT = 0.75;

/**
 * The one number games are ranked by (the Rating sort, the rating-based
 * carousels, Pick My Game), on the critic score's scale: the average of the
 * critic score and Steam's review score, so what players think counts as much
 * as what critics did (a game critics loved and players didn't ranks lower).
 * Steam's score is weighted by how many reviews it's from and converted to
 * the critic scale first. A game with only one of them is estimated from it.
 */
export function ratingOf(
  game: CriticScored & { steam_review_score?: number | null; steam_review_count?: number | null },
) {
  const critic = criticScoreOf(game);
  const steam =
    game.steam_review_score != null && game.steam_review_count
      ? steamOnCriticScale(weightedSteamScore(game.steam_review_score, game.steam_review_count))
      : null;
  if (critic !== null && steam !== null) return (critic + steam) / 2;
  const one = critic ?? steam;
  return one === null ? null : AVERAGE_RATING + ONE_SIDE_WEIGHT * (one - AVERAGE_RATING);
}
