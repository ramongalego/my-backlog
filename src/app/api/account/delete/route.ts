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
 * The password is asked first, so a computer left signed in can't do it. An
 * account without one types "delete", which only stops a slip. Which is asked
 * is the account's to decide, never the request's.
 *
 * Deleting the Auth user cascades to every row; profile pictures aren't rows.
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

  // After the account, so a failure can't leave a profile pointing at a
  // deleted file.
  await deleteAvatars(service, user.id);

  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
