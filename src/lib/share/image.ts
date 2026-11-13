// Which game art a public share page may show. The Open Graph image route
// fetches the art on the server (next/og needs a raw image), so it's limited to
// the hosts game art really comes from: nothing else can be fetched through it.
import { IGDB_IMAGE_HOST } from '@/lib/igdb/images';
// SteamGridDB's art: for console games neither Steam nor IGDB has wide art
// for (lib/server/manual-details.ts), and any game whose art the player chose.
import { STEAMGRIDDB_IMAGE_HOST } from '@/lib/steamgriddb/images';

function isAllowedImageHost(hostname: string): boolean {
  return (
    hostname === IGDB_IMAGE_HOST ||
    hostname === STEAMGRIDDB_IMAGE_HOST ||
    hostname === 'steamcdn-a.akamaihd.net' ||
    hostname.endsWith('.steamstatic.com') ||
    hostname === 'steamstatic.com'
  );
}

/**
 * The art's URL when it's https on one of those hosts, else null: a share page
 * without art is better than no share page.
 */
export function safeShareImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && isAllowedImageHost(parsed.hostname) ? url : null;
  } catch {
    return null;
  }
}
