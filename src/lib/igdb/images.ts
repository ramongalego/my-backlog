// Safe to import anywhere: no credentials.

export const IGDB_IMAGE_HOST = 'images.igdb.com';

/** Box art is drawn centered on a blurred copy of itself, not cropped to the wide frame. */
export function isBoxArt(src: string | null | undefined): boolean {
  return !!src && src.includes(IGDB_IMAGE_HOST) && src.includes('/t_cover_');
}
