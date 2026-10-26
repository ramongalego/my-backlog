// Safe to import anywhere: just URL checks, no credentials.

export const IGDB_IMAGE_HOST = 'images.igdb.com';

/**
 * Whether a game image is IGDB's tall box art rather than wide art. Games
 * added by hand fall back to it when IGDB has no wide artwork, and it's drawn
 * centred on a blurred copy of itself instead of cropped to the wide frame.
 */
export function isBoxArt(src: string | null | undefined): boolean {
  return !!src && src.includes(IGDB_IMAGE_HOST) && src.includes('/t_cover_');
}
