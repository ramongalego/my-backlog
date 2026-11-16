import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

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
 * Deletes every picture in a player's folder but the one to keep (none, when
 * the picture is taken off or the account deleted). By the folder, not by the
 * URL the profile had: a picture left behind by two uploads at once, or by a
 * failed delete, goes with the next change. A failure is logged and left: a
 * file nothing points at is only clutter.
 */
export async function deleteAvatars(
  service: SupabaseClient,
  userId: string,
  keep?: string,
): Promise<void> {
  const pictures = service.storage.from(AVATAR_BUCKET);
  // A folder holds one picture, or a few after a failure: far under the limit.
  const { data: files, error: listError } = await pictures.list(userId, { limit: 1000 });
  if (listError) {
    console.error('Listing profile pictures failed:', listError);
    return;
  }
  const paths = (files ?? []).map((file) => `${userId}/${file.name}`).filter((p) => p !== keep);
  if (paths.length === 0) return;
  const { error } = await pictures.remove(paths);
  if (error) console.error('Deleting profile pictures failed:', error);
}
