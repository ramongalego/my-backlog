import type { GameItem } from '@/lib/data/loaders';
import { filterLibrary, searchLibrary } from '@/lib/games/library-filter';

// The Profile page's favorites are only the games the player picked: none until they pick.

/** As many favorites as the profile's row holds. */
export const MAX_FAVORITES = 4;

export interface FavoriteGame {
  id: number;
  name: string;
  header_image: string | null;
  /** Your rating, drawn on the art; null when the game has none. */
  rating: number | null;
}

/** A rating only means something on a finished or dropped game (as on its card). */
export const shownRating = (game: Pick<GameItem, 'status' | 'rating'>) =>
  game.status === 'finished' || game.status === 'dropped' ? game.rating : null;

/** In the order picked; one hidden since, or no longer in the library, is left out. */
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

/** A new pick goes at the end; nothing changes when all four places are taken. */
export function toggleFavorite(pickedIds: readonly number[], id: number): number[] {
  if (pickedIds.includes(id)) return pickedIds.filter((picked) => picked !== id);
  if (pickedIds.length >= MAX_FAVORITES) return [...pickedIds];
  return [...pickedIds, id];
}

export function sameFavorites(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Everything but hidden games, highest rated first (a favorite is likely among
 * them), and games named for the search ahead of those only tagged with it.
 */
export function favoriteChoices(games: GameItem[], query: string): GameItem[] {
  const text = query.trim();
  return filterLibrary(searchLibrary(games, text), 'all', 'rating', text);
}
