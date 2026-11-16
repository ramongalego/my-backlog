import 'server-only';

/** The storage bucket profile pictures go in (see the 20261116 migration). */
export const AVATAR_BUCKET = 'avatars';

/** The largest picture taken, as the bucket allows: the browser sends far less. */
export const MAX_AVATAR_BYTES = 512 * 1024;

const EXTENSION = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' } as const;
type AvatarType = keyof typeof EXTENSION;

/**
 * What kind of picture these bytes are, read from the file itself rather than
 * from what the upload says it is: WebP, PNG or JPEG, or null for anything
 * else.
 */
export function imageTypeOf(bytes: Uint8Array): AvatarType | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

/** Where a new picture of this player's is stored: their own folder, a name of its own. */
export function newAvatarPath(userId: string, type: AvatarType): string {
  return `${userId}/${crypto.randomUUID()}.${EXTENSION[type]}`;
}

/**
 * The stored file behind a profile's picture URL, so the old one can be
 * deleted when it's replaced: only a file in this player's own folder of the
 * avatars bucket, never anything else a URL might point at.
 */
export function avatarPathOf(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) && !path.includes('..') ? path : null;
}
