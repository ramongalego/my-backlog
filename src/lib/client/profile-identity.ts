// These never throw: each says what happened, with a message the page can show as is.

import { apiRequest, json, type ApiResult } from './request';

/** The side of the square picture that's uploaded: twice the largest it's drawn (80px). */
const AVATAR_SIDE = 256;
/** Behind a transparent picture saved as JPEG: the avatar tile's own color (ink-800). */
const AVATAR_BACKDROP = '#2a2622';

const TOO_MANY = 'Too many changes in a row. Try again later.';

/** Null clears it, back to the name the account has. */
export function saveProfileName(name: string | null): Promise<ApiResult<{ name: string | null }>> {
  return apiRequest('/api/profile/name', json('PUT', { name }), {
    failed: "Couldn't save your name. Please try again.",
    tooMany: TOO_MANY,
  });
}

/** A failure about the username itself (taken, not allowed) comes back with `field`. */
export function saveUsername(
  username: string,
): Promise<ApiResult<{ username: string }, 'username'>> {
  return apiRequest('/api/profile/username', json('PUT', { username }), {
    failed: "Couldn't save your username. Please try again.",
    tooMany: TOO_MANY,
  });
}

/** Whether other people can see the profile. */
export function saveProfilePrivacy(isPrivate: boolean): Promise<ApiResult<{ private: boolean }>> {
  return apiRequest('/api/profile/privacy', json('PUT', { private: isPrivate }), {
    failed: "Couldn't save that. Please try again.",
    tooMany: TOO_MANY,
  });
}

/** Whether the AI features are offered (and anything is sent to a model). */
export function saveAiFeatures(enabled: boolean): Promise<ApiResult<{ enabled: boolean }>> {
  return apiRequest('/api/profile/ai', json('PUT', { enabled }), {
    failed: "Couldn't save that. Please try again.",
    tooMany: TOO_MANY,
  });
}

/** Already made square (see squareAvatar). */
export function uploadAvatar(picture: Blob): Promise<ApiResult<{ avatarUrl: string }>> {
  const form = new FormData();
  form.append('file', picture);
  return apiRequest(
    '/api/profile/avatar',
    { method: 'POST', body: form },
    { failed: "Couldn't save your avatar. Please try again.", tooMany: TOO_MANY },
  );
}

export function removeAvatar(): Promise<ApiResult<{ avatarUrl: null }>> {
  return apiRequest(
    '/api/profile/avatar',
    { method: 'DELETE' },
    { failed: "Couldn't remove your avatar. Please try again.", tooMany: TOO_MANY },
  );
}

/**
 * The middle of the picture, 256px a side, as WebP (or JPEG or PNG where the
 * browser can't make WebP). Null when the browser can't read it.
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
  // Safari makes a PNG when asked for WebP; JPEG is smaller then, but clear parts
  // would come out black, so it's drawn again over the avatar tile's color.
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
