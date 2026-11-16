// Client helpers for the name and picture on the Profile page
// (/api/profile/name, /api/profile/avatar), and for making the small square
// picture that's uploaded. They never throw: each says what happened, with a
// message the page can show as is.

export type IdentityResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** The side of the square picture that's uploaded: twice the largest it's drawn (80px). */
const AVATAR_SIDE = 256;

const OFFLINE = "Couldn't reach MyBacklog. Check your connection and try again.";

async function send<T>(
  url: string,
  init: RequestInit,
  fallback: string,
): Promise<IdentityResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: OFFLINE };
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true, ...(data as T) };
  if (res.status === 429)
    return { ok: false, error: 'Too many changes in a row. Try again later.' };
  return { ok: false, error: data?.error ?? fallback };
}

/** Sets the profile's name, or clears it (null) to go back to the one the account has. */
export function saveProfileName(name: string | null) {
  return send<{ name: string | null }>(
    '/api/profile/name',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    },
    "Couldn't save your name. Please try again.",
  );
}

/** Uploads a profile picture already made square (see squareAvatar). */
export function uploadAvatar(picture: Blob) {
  const form = new FormData();
  form.append('file', picture);
  return send<{ avatarUrl: string }>(
    '/api/profile/avatar',
    { method: 'POST', body: form },
    "Couldn't save your picture. Please try again.",
  );
}

/** Takes the profile picture off. */
export function removeAvatar() {
  return send<{ avatarUrl: null }>(
    '/api/profile/avatar',
    { method: 'DELETE' },
    "Couldn't remove your picture. Please try again.",
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
  if (!context) return null;
  context.imageSmoothingQuality = 'high';
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
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Safari makes a PNG when asked for WebP; JPEG is smaller then.
  const webp = await encode('image/webp');
  if (webp?.type === 'image/webp') return webp;
  return (await encode('image/jpeg')) ?? webp;
}
