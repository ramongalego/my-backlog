import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { checkPassword, passwordCheckRefusal, passwordRefusal } from '@/lib/server/account';
import { changePasswordBodySchema } from '@/lib/validations/auth';

/**
 * The current password is asked first, so a computer left signed in can't be
 * taken over. Every other device is signed out afterwards.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return jsonError('Unauthorized', 401);

  // Fails closed: without the shared counter, guesses would go unlimited.
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
  const parsed = changePasswordBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  const { currentPassword, newPassword } = parsed.data;

  const check = await checkPassword(user.email, currentPassword);
  if (check !== 'right') {
    const refusal = passwordCheckRefusal(check, {
      error: "That isn't your current password",
      field: 'currentPassword',
    });
    return NextResponse.json(
      { error: refusal.error, field: refusal.field },
      { status: refusal.status },
    );
  }

  // Sent to Supabase too, which refuses without it when "Require current
  // password when updating" is on; the check above works either way.
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });
  if (error) {
    const refusal = passwordRefusal(error.code, error.message);
    if (refusal.status >= 500) console.error('Password change failed:', error);
    return NextResponse.json(
      { error: refusal.error, field: refusal.field },
      { status: refusal.status },
    );
  }

  // The password is changed whatever happens here; a device left signed in is
  // the lesser problem, so it's logged rather than reported as a failure.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
  if (signOutError) console.error('Signing out other devices failed:', signOutError);

  return NextResponse.json({ ok: true });
}
