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

// Steam's percent positive runs higher than critics' (95% is about 88), so
// Steam-only games would outrank better-reviewed ones. Matched by percentile
// over 143 games with plenty of both (October 2026); linear in between.
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

// A Steam score is read as if it had this many more reviews at STEAM_AVERAGE.
// More than statistics needs, to reward breadth (96% of 220,000 ranks above 98%
// of 12,000); small games shine in Hidden Gems instead, ranked by raw score.
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

// Critics and players correlate at about 0.5 (same 143 games), so a one-sided
// score keeps three-quarters of its distance from the average. Otherwise one
// glowing score outranks two that mostly agree (Portal over Baldur's Gate 3).
const AVERAGE_RATING = 81;
const ONE_SIDE_WEIGHT = 0.75;

/**
 * The one number every ranking uses (the Rating sort, carousels, Pick My Game),
 * on the critic scale. Players count as much as critics: a game critics loved
 * and players didn't ranks lower.
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
