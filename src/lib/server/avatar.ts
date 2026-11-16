import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** The storage bucket profile pictures go in (see the 20261116 migration). */
export const AVATAR_BUCKET = 'avatars';

/** The largest picture taken, as the bucket allows: the browser sends far less. */
export const MAX_AVATAR_BYTES = 512 * 1024;

const EXTENSION = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' } as const;
type AvatarType = keyof typeof EXTENSION;

/** The widest or tallest picture taken: the browser sends 256px, so this is generous. */
export const MAX_AVATAR_SIDE = 1024;

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));
const be16 = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const le16 = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);
const le24 = (bytes: Uint8Array, at: number) => le16(bytes, at) | (bytes[at + 2] << 16);

/** A PNG's size, from its first chunk (IHDR). */
function pngSize(bytes: Uint8Array) {
  if (bytes.length < 24 || ascii(bytes, 12, 16) !== 'IHDR') return null;
  return {
    width: be16(bytes, 16) * 65536 + be16(bytes, 18),
    height: be16(bytes, 20) * 65536 + be16(bytes, 22),
  };
}

/** A JPEG's size, from the frame header found by walking its segments. */
function jpegSize(bytes: Uint8Array) {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    // Padding before a marker, and markers that carry nothing.
    if (marker === 0xff) at += 1;
    else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) at += 2;
    // The picture's data starts, or the file ends, with no frame header seen.
    else if (marker === 0xda || marker === 0xd9) return null;
    // Start of frame (every kind; C4, C8 and CC are tables, not frames).
    else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: be16(bytes, at + 7), height: be16(bytes, at + 5) };
    } else at += 2 + be16(bytes, at + 2);
  }
  return null;
}

/** A WebP's size, from whichever of its three headers it has. */
function webpSize(bytes: Uint8Array) {
  if (bytes.length < 30) return null;
  const kind = ascii(bytes, 12, 16);
  if (kind === 'VP8X') return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  if (kind === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * What picture these bytes are, read from the file itself rather than from
 * what the upload says it is: its kind (WebP, PNG or JPEG) and its size, from
 * its header. Null for anything else, and for a file that starts like a
 * picture but has no header to read: it would be stored and then draw as a
 * broken image. (The header is as far as this looks: it doesn't decode it.)
 */
export function readImage(
  bytes: Uint8Array,
): { type: AvatarType; width: number; height: number } | null {
  let type: AvatarType;
  let size: { width: number; height: number } | null;
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    type = 'image/webp';
    size = webpSize(bytes);
  } else if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') {
    type = 'image/png';
    size = pngSize(bytes);
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    type = 'image/jpeg';
    size = jpegSize(bytes);
  } else return null;
  if (!size || size.width < 1 || size.height < 1) return null;
  return { type, ...size };
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
