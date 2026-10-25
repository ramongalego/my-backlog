export interface GameForFiltering {
  type?: string | null;
  status?: string | null;
  main_story_hours?: number | null;
  playtime_forever?: number | null;
  categories?: string[] | null;
  steam_review_weighted?: number | null;
}

export const SHORT_GAME_MIN_HOURS = 1;
export const SHORT_GAME_MAX_HOURS = 5;
export const WEEKEND_GAME_MIN_HOURS = 5;
export const WEEKEND_GAME_MAX_HOURS = 12;
export const MAX_PLAYTIME_MINUTES = 240;
// Random pick uses a stricter "barely touched" playtime bound than the pools.
export const RANDOM_PICK_MAX_PLAYTIME_MINUTES = 120;

// The short and weekend carousels are built in carousels.ts.

/**
 * Checks if a game is eligible for random pick (broader criteria)
 */
export function isRandomPickEligible(game: GameForFiltering): boolean {
  // Must be a game
  if (game.type !== 'game') return false;

  // Must have main story hours
  if (game.main_story_hours == null) return false;

  // Must have 2 hours or less playtime (120 minutes)
  if (game.playtime_forever != null && game.playtime_forever > RANDOM_PICK_MAX_PLAYTIME_MINUTES) {
    return false;
  }

  // Must be single-player
  if (!game.categories?.includes('Single-player')) return false;

  // Must be in backlog or have no status
  if (game.status != null && game.status !== 'backlog') return false;

  return true;
}
