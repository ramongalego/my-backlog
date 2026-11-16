import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import {
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  deleteAvatars,
  imageTypeOf,
  newAvatarPath,
} from '@/lib/server/avatar';

/** The signed-in player, and the service client their profile is written with. */
async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, service: tryCreateServiceClient() };
}

/**
 * Sets the player's profile picture: the small square the browser made, sent
 * as the form field `file`. Checked by its own bytes (WebP, PNG or JPEG, at
 * most 512 KB), stored under a new name in the player's folder, and whatever
 * else is in the folder deleted.
 */
export async function POST(request: NextRequest) {
  const { user, service } = await signedIn();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = await checkSharedRateLimit(`avatar-upload:${user.id}`, RATE_LIMITS.avatarUpload);
  if (!limit.success) return rateLimited(limit);

  // Refused by its declared size before any of it is read. (The form adds a
  // little around the file, hence the allowance.)
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_AVATAR_BYTES + 4096) return jsonError('That picture is too large', 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return jsonError('Send the picture as a form', 400);
  }
  if (!(file instanceof Blob)) return jsonError('No picture was sent', 400);
  if (file.size > MAX_AVATAR_BYTES) return jsonError('That picture is too large', 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageTypeOf(bytes);
  if (!type) return jsonError('Use a JPEG, PNG or WebP picture', 400);

  if (!service) return jsonError("Couldn't save your picture. Please try again.", 500);

  const path = newAvatarPath(user.id, type);
  const { error: uploadError } = await service.storage
    .from(AVATAR_BUCKET)
    // A new name every time, so a year's caching never shows an old picture.
    .upload(path, bytes, { contentType: type, cacheControl: '31536000', upsert: false });
  if (uploadError) {
    console.error('Uploading the profile picture failed:', uploadError);
    return jsonError("Couldn't save your picture. Please try again.", 500);
  }
  const avatarUrl = service.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

  const { error } = await service
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error('Saving the profile picture failed:', error);
    const { error: undoError } = await service.storage.from(AVATAR_BUCKET).remove([path]);
    if (undoError) console.error('Deleting the unsaved picture failed:', undoError);
    return jsonError("Couldn't save your picture. Please try again.", 500);
  }

  // Everything else in the folder: the picture this replaces, and any left
  // behind by two uploads at once.
  await deleteAvatars(service, user.id, path);
  return NextResponse.json({ avatarUrl });
}

/** Takes the picture off: the profile goes back to the Steam one, or the initial. */
export async function DELETE() {
  const { user, service } = await signedIn();
  if (!user) return jsonError('Unauthorized', 401);
  const limit = checkRateLimit(`profile-write:${user.id}`, RATE_LIMITS.profileWrite);
  if (!limit.success) return rateLimited(limit);
  if (!service) return jsonError("Couldn't remove your picture. Please try again.", 500);

  const { error } = await service
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error('Removing the profile picture failed:', error);
    return jsonError("Couldn't remove your picture. Please try again.", 500);
  }

  await deleteAvatars(service, user.id);
  return NextResponse.json({ avatarUrl: null });
}
