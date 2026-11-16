// Client helpers for the name and picture on the Profile page
// (/api/profile/name, /api/profile/avatar), and for making the small square
// picture that's uploaded. They never throw: each says what happened, with a
// message the page can show as is.

import { apiRequest, json, type ApiResult } from './request';

/** The side of the square picture that's uploaded: twice the largest it's drawn (80px). */
const AVATAR_SIDE = 256;
/** What shows through a see-through picture where it's saved as JPEG: the avatar tile's own (ink-800). */
const AVATAR_BACKDROP = '#2a2622';

const TOO_MANY = 'Too many changes in a row. Try again later.';

/** Sets the profile's name, or clears it (null) to go back to the one the account has. */
export function saveProfileName(name: string | null): Promise<ApiResult<{ name: string | null }>> {
  return apiRequest('/api/profile/name', json('PUT', { name }), {
    failed: "Couldn't save your name. Please try again.",
    tooMany: TOO_MANY,
  });
}

/** Uploads a profile picture already made square (see squareAvatar). */
export function uploadAvatar(picture: Blob): Promise<ApiResult<{ avatarUrl: string }>> {
  const form = new FormData();
  form.append('file', picture);
  return apiRequest(
    '/api/profile/avatar',
    { method: 'POST', body: form },
    { failed: "Couldn't save your picture. Please try again.", tooMany: TOO_MANY },
  );
}

/** Takes the profile picture off. */
export function removeAvatar(): Promise<ApiResult<{ avatarUrl: null }>> {
  return apiRequest(
    '/api/profile/avatar',
    { method: 'DELETE' },
    { failed: "Couldn't remove your picture. Please try again.", tooMany: TOO_MANY },
  );
}

/**
 * A picture the player chose, as the small square that's uploaded: the middle
 * of it, 256px a side, as WebP (or JPEG or PNG where the browser can't make
 * WebP). A phone photo of several megabytes comes out at a few dozen
 * kilobytes. Null when the browser can't read it (a format it doesn't know).
 */
export async function squareAvatar(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIDE;
  canvas.height = AVATAR_SIDE;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return null;
  }
  context.imageSmoothingQuality = 'high';
  const draw = () =>
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIDE,
      AVATAR_SIDE,
    );
  draw();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Safari makes a PNG when asked for WebP; JPEG is smaller then. JPEG has no
  // transparency, and clear parts would come out black: drawn again over the
  // avatar tile's own color first.
  const webp = await encode('image/webp');
  if (webp?.type === 'image/webp') {
    bitmap.close();
    return webp;
  }
  context.fillStyle = AVATAR_BACKDROP;
  context.fillRect(0, 0, AVATAR_SIDE, AVATAR_SIDE);
  draw();
  bitmap.close();
  return (await encode('image/jpeg')) ?? webp;
}
