// Safe to import anywhere: just URL checks, no credentials.

/** Where SteamGridDB serves its art from. Keep in step with next.config.ts. */
export const STEAMGRIDDB_IMAGE_HOST = 'cdn2.steamgriddb.com';

/** Whether a URL is an image on SteamGridDB's art host, over https. */
export function isSteamGridDbImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === STEAMGRIDDB_IMAGE_HOST;
  } catch {
    return false;
  }
}
