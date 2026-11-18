import { isSteamGridDbImage } from '@/lib/steamgriddb/images';

export interface GameArtColumns {
  header_image: string | null;
  art_chosen: boolean;
  default_header_image: string | null;
}

export function originalArt(game: GameArtColumns): string | null {
  return game.art_chosen ? game.default_header_image : game.header_image;
}

/**
 * `url` null goes back to the original. Returns null for art not from
 * SteamGridDB: art shows on public share pages. Choosing again keeps the first
 * default.
 */
export function chooseArt(game: GameArtColumns, url: string | null): GameArtColumns | null {
  if (url === null || url === originalArt(game)) {
    return { header_image: originalArt(game), art_chosen: false, default_header_image: null };
  }
  if (!isSteamGridDbImage(url)) return null;
  return { header_image: url, art_chosen: true, default_header_image: originalArt(game) };
}

/** For a game whose art the player chose, fresh art goes to the default behind it. */
export function syncedArt(game: { art_chosen: boolean }, art: string | null) {
  return game.art_chosen ? { default_header_image: art } : { header_image: art };
}
