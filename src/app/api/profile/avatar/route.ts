import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import {
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  avatarPathOf,
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

/** The picture the profile has now, to delete once it's replaced. */
async function currentAvatar(service: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await service.from('profiles').select('avatar_url').eq('id', userId).single();
  return data?.avatar_url ?? null;
}

/** Deletes a picture that's no longer used. A file left behind is only clutter. */
async function deleteAvatar(service: SupabaseClient, url: string | null, userId: string) {
  const path = avatarPathOf(url, userId);
  if (!path) return;
  const { error } = await service.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.error('Deleting the old profile picture failed:', error);
}

/**
 * Sets the player's profile picture: the small square the browser made, sent
 * as the form field `file`. Checked by its own bytes (WebP, PNG or JPEG, at
 * most 512 KB), stored under a new name in the player's folder, and the old
 * one deleted.
 */
export async function POST(request: NextRequest) {
  const { user, service } = await signedIn();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = await checkSharedRateLimit(`avatar-upload:${user.id}`, RATE_LIMITS.avatarUpload);
  if (!limit.success) return rateLimited(limit);

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
  const before = await currentAvatar(service, user.id);

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
    await deleteAvatar(service, avatarUrl, user.id);
    return jsonError("Couldn't save your picture. Please try again.", 500);
  }

  await deleteAvatar(service, before, user.id);
  return NextResponse.json({ avatarUrl });
}

/** Takes the picture off: the profile goes back to the Steam one, or the initial. */
export async function DELETE() {
  const { user, service } = await signedIn();
  if (!user) return jsonError('Unauthorized', 401);
  if (!service) return jsonError("Couldn't remove your picture. Please try again.", 500);

  const before = await currentAvatar(service, user.id);
  const { error } = await service
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error('Removing the profile picture failed:', error);
    return jsonError("Couldn't remove your picture. Please try again.", 500);
  }

  await deleteAvatar(service, before, user.id);
  return NextResponse.json({ avatarUrl: null });
}
