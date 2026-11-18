export interface GameForFiltering {
  type?: string | null;
  status?: string | null;
  main_story_hours?: number | null;
  playtime_forever?: number | null;
  categories?: string[] | null;
  steam_review_weighted?: number | null;
}

export const SHORT_GAME_MIN_HOURS = 1;
// A short game is one you can finish in one sitting.
export const SHORT_GAME_MAX_HOURS = 6;
export const WEEKEND_GAME_MIN_HOURS = 6;
export const WEEKEND_GAME_MAX_HOURS = 12;
export const MAX_PLAYTIME_MINUTES = 240;
// Random pick uses a stricter "barely touched" playtime bound than the pools.
export const RANDOM_PICK_MAX_PLAYTIME_MINUTES = 120;

export function isRandomPickEligible(game: GameForFiltering): boolean {
  if (game.type !== 'game') return false;

  if (game.main_story_hours == null) return false;

  if (game.playtime_forever != null && game.playtime_forever > RANDOM_PICK_MAX_PLAYTIME_MINUTES) {
    return false;
  }

  if (!game.categories?.includes('Single-player')) return false;

  if (game.status != null && game.status !== 'backlog') return false;

  return true;
}
