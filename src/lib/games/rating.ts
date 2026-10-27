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

/**
 * The one number games are ranked by (the Rating sort, the rating-based
 * carousels, Pick My Game): the critic score, which every kind of game can
 * have, else the Steam review score, weighted by how many reviews it's from.
 * It's what each card's meta row shows first, so the order matches the cards.
 */
export function ratingOf(game: CriticScored & { steam_review_weighted?: number | null }) {
  return criticScoreOf(game) ?? game.steam_review_weighted ?? null;
}
