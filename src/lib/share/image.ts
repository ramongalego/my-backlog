// The Open Graph route fetches the art on the server (next/og needs a raw
// image), so only hosts game art comes from are allowed: nothing else can be
// fetched through it.
import { IGDB_IMAGE_HOST } from '@/lib/igdb/images';
// For console games Steam and IGDB have no wide art for, and art the player chose.
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

/** Null unless https on an allowed host: a share page without art beats none. */
export function safeShareImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && isAllowedImageHost(parsed.hostname) ? url : null;
  } catch {
    return null;
  }
}
