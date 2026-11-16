import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { isCurrentPassword } from '@/lib/server/account';
import { AVATAR_BUCKET } from '@/lib/server/avatar';

const bodySchema = z.object({ password: z.string().min(1, 'Enter your password').max(200) });

/**
 * Deletes the signed-in player's account and everything in it, for good. The
 * password is asked for first, so someone at a computer left signed in can't
 * do it, and tries count against the same limit as changing the password.
 *
 * Deleting the Supabase Auth user takes every row with it (the profile, its
 * games and so the diary, the queue, favorites, share pages, support tickets:
 * all cascade from it). The profile pictures aren't rows, so they're deleted
 * from storage first. The session's cookies are cleared on the way out.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return jsonError('Unauthorized', 401);

  const limit = await checkSharedRateLimit(
    `account-password:${user.id}`,
    RATE_LIMITS.accountPassword,
    { failClosed: true },
  );
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', field: 'password' },
      { status: 400 },
    );
  }

  if (!(await isCurrentPassword(user.email, parsed.data.password))) {
    return NextResponse.json(
      { error: "That isn't your password", field: 'password' },
      { status: 400 },
    );
  }

  const service = tryCreateServiceClient();
  if (!service) return jsonError("Couldn't delete your account. Please try again.", 500);

  // The pictures first: once the account is gone, nothing points at them.
  const pictures = service.storage.from(AVATAR_BUCKET);
  const { data: files } = await pictures.list(user.id);
  if (files?.length) {
    const { error } = await pictures.remove(files.map((file) => `${user.id}/${file.name}`));
    if (error) console.error('Deleting profile pictures failed:', error);
  }

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('Deleting the account failed:', error);
    return jsonError("Couldn't delete your account. Please try again.", 500);
  }

  // The session belonged to the account just deleted: clear its cookies.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
