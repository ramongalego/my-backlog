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

/**
 * Checks if a game is eligible for the short games pool (1-5 hours)
 */
export function isShortGameEligible(game: GameForFiltering): boolean {
  // Must be a game (not DLC/software)
  if (game.type !== 'game') return false;

  // Must have main story hours data
  if (game.main_story_hours == null) return false;

  // Must have weighted review score (for sorting)
  if (game.steam_review_weighted == null) return false;

  // Must be between 1-5 hours
  if (game.main_story_hours < SHORT_GAME_MIN_HOURS) return false;
  if (game.main_story_hours > SHORT_GAME_MAX_HOURS) return false;

  // Must not have been played too much (< 4 hours)
  if (game.playtime_forever != null && game.playtime_forever > MAX_PLAYTIME_MINUTES) {
    return false;
  }

  // Must be single-player
  if (!game.categories?.includes('Single-player')) return false;

  // Must be in backlog or have no status
  if (game.status != null && game.status !== 'backlog') return false;

  return true;
}

/**
 * Checks if a game is eligible for the weekend games pool (5-12 hours)
 */
export function isWeekendGameEligible(game: GameForFiltering): boolean {
  // Must be a game (not DLC/software)
  if (game.type !== 'game') return false;

  // Must have main story hours data
  if (game.main_story_hours == null) return false;

  // Must have weighted review score (for sorting)
  if (game.steam_review_weighted == null) return false;

  // Must be between 5-12 hours (exclusive of 5 since that's in short games)
  if (game.main_story_hours <= WEEKEND_GAME_MIN_HOURS) return false;
  if (game.main_story_hours > WEEKEND_GAME_MAX_HOURS) return false;

  // Must not have been played too much (< 4 hours)
  if (game.playtime_forever != null && game.playtime_forever > MAX_PLAYTIME_MINUTES) {
    return false;
  }

  // Must be single-player
  if (!game.categories?.includes('Single-player')) return false;

  // Must be in backlog or have no status
  if (game.status != null && game.status !== 'backlog') return false;

  return true;
}

/**
 * Checks if a game is eligible for random pick (broader criteria)
 */
export function isRandomPickEligible(game: GameForFiltering): boolean {
  // Must be a game
  if (game.type !== 'game') return false;

  // Must have main story hours
  if (game.main_story_hours == null) return false;

  // Must have 2 hours or less playtime (120 minutes)
  if (game.playtime_forever != null && game.playtime_forever > 120) {
    return false;
  }

  // Must be single-player
  if (!game.categories?.includes('Single-player')) return false;

  // Must be in backlog or have no status
  if (game.status != null && game.status !== 'backlog') return false;

  return true;
}
