import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { accountHasPassword, checkPassword, passwordCheckRefusal } from '@/lib/server/account';
import { deleteAvatars } from '@/lib/server/avatar';
import { DELETE_CONFIRM_ERROR, confirmsDelete } from '@/lib/account/sign-in';

const bodySchema = z.object({
  password: z.string().max(200).optional(),
  confirm: z.string().max(50).optional(),
});

/**
 * Deletes the signed-in player's account and everything in it, for good. The
 * password is asked for first, so someone at a computer left signed in can't
 * do it, and tries count against the same limit as changing the password.
 *
 * An account made with Google or Discord has no password to ask for: it types
 * the word "delete" instead, which only stops a slip. Which of the two is
 * asked is the account's to decide, not the request's: one with a password
 * is never deleted without it.
 *
 * Deleting the Supabase Auth user takes every row with it (the profile, its
 * games and so the diary, the queue, favorites, share pages, support tickets:
 * all cascade from it). The profile pictures aren't rows, so they're deleted
 * from storage after it. The session's cookies are cleared on the way out.
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

  if (await accountHasPassword(supabase, user)) {
    const { password } = parsed.data;
    if (!password) {
      // The page asked for the word: it was loaded before the password was set.
      const error = parsed.data.confirm
        ? 'Your account has a password now. Reload the page and try again.'
        : 'Enter your password';
      return NextResponse.json(parsed.data.confirm ? { error } : { error, field: 'password' }, {
        status: 400,
      });
    }
    const check = await checkPassword(user.email, password);
    if (check !== 'right') {
      const refusal = passwordCheckRefusal(check, {
        error: "That isn't your password",
        field: 'password',
      });
      return NextResponse.json(
        { error: refusal.error, field: refusal.field },
        { status: refusal.status },
      );
    }
  } else if (!confirmsDelete(parsed.data.confirm)) {
    return NextResponse.json({ error: DELETE_CONFIRM_ERROR, field: 'password' }, { status: 400 });
  }

  const service = tryCreateServiceClient();
  if (!service) return jsonError("Couldn't delete your account. Please try again.", 500);

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('Deleting the account failed:', error);
    return jsonError("Couldn't delete your account. Please try again.", 500);
  }

  // Then the pictures, which aren't rows and so didn't go with it. After the
  // account, so a failure here can't leave a profile pointing at a deleted
  // file; it's logged, since nothing will look in this folder again.
  await deleteAvatars(service, user.id);

  // The session belonged to the account just deleted: clear its cookies.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
