import { isSteamGridDbImage } from '@/lib/steamgriddb/images';

/** The columns that hold a game's art, and whether the player chose it. */
export interface GameArtColumns {
  header_image: string | null;
  art_chosen: boolean;
  default_header_image: string | null;
}

/** The art a game would show if the player hadn't chosen any. */
export function originalArt(game: GameArtColumns): string | null {
  return game.art_chosen ? game.default_header_image : game.header_image;
}

/**
 * The columns to save when the player picks art for a game (`url`), or goes
 * back to the original (`null`). Null when the pick isn't allowed: only
 * SteamGridDB's images can be chosen, since art shows on public share pages.
 * The art it replaces is kept as the default the first time; choosing again
 * keeps that first one.
 */
export function chooseArt(game: GameArtColumns, url: string | null): GameArtColumns | null {
  if (url === null || url === originalArt(game)) {
    return { header_image: originalArt(game), art_chosen: false, default_header_image: null };
  }
  if (!isSteamGridDbImage(url)) return null;
  return { header_image: url, art_chosen: true, default_header_image: originalArt(game) };
}

/**
 * The column a sync writes fresh art to: the one shown, or for a game whose
 * art the player chose, the default behind it.
 */
export function syncedArt(game: { art_chosen: boolean }, art: string | null) {
  return game.art_chosen ? { default_header_image: art } : { header_image: art };
}
