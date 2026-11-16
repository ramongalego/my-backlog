import type { GameItem } from '@/lib/data/loaders';
import { filterLibrary, searchLibrary } from '@/lib/games/library-filter';

// The favorite games on a player's Profile page: the ones they picked, in
// their order, or their highest rated until they pick.

/** As many favorites as the profile's row holds. */
export const MAX_FAVORITES = 4;

/** A favorite as the profile draws it. */
export interface FavoriteGame {
  id: number;
  name: string;
  header_image: string | null;
  /** Your rating, drawn on the art; null when the game has none. */
  rating: number | null;
}

/** A rating only means something on a finished or dropped game (as on its card). */
const shownRating = (game: GameItem) =>
  game.status === 'finished' || game.status === 'dropped' ? game.rating : null;

/**
 * The picked games as the library has them now, in the order picked. One that
 * has since been hidden, or is no longer in the library, is left out.
 */
export function pickedFavorites(games: GameItem[], pickedIds: readonly number[]): FavoriteGame[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  return pickedIds.flatMap((id) => {
    const game = byId.get(id);
    if (!game || game.status === 'hidden') return [];
    return [
      { id: game.id, name: game.name, header_image: game.header_image, rating: shownRating(game) },
    ];
  });
}

/**
 * A pick turned on or off: off if it's picked, on at the end if there's a
 * place left, and unchanged when all four are taken.
 */
export function toggleFavorite(pickedIds: readonly number[], id: number): number[] {
  if (pickedIds.includes(id)) return pickedIds.filter((picked) => picked !== id);
  if (pickedIds.length >= MAX_FAVORITES) return [...pickedIds];
  return [...pickedIds, id];
}

/** Whether two lists of picks are the same games in the same order. */
export function sameFavorites(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * The games to pick from, for a search: everything in the library but hidden
 * games, the ones you rated highest first (a favorite is likely among them),
 * and games named for the search ahead of those only tagged with it.
 */
export function favoriteChoices(games: GameItem[], query: string): GameItem[] {
  const text = query.trim();
  return filterLibrary(searchLibrary(games, text), 'all', 'rating', text);
}
