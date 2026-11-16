import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { checkPassword, emailRefusal, passwordCheckRefusal } from '@/lib/server/account';
import { changeEmailBodySchema } from '@/lib/validations/auth';

/**
 * Where a confirmation link lands: the auth callback, which knows this flow
 * by its name and goes on to the profile.
 */
const EMAIL_CHANGE_REDIRECT = '/auth/callback?flow=email-change&next=/profile';

/**
 * Starts changing the signed-in player's email, once their password confirms
 * it's them: a new email is a way into the account (through Forgot password),
 * so it's guarded like changing the password. Supabase emails a link to
 * confirm it (with secure email change on, one to each address), and the
 * email only changes once that's done; until then it's the account's
 * `new_email`, which the profile shows as waiting.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return jsonError('Unauthorized', 401);

  const limit = await checkSharedRateLimit(`account-email:${user.id}`, RATE_LIMITS.accountEmail);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = changeEmailBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: issue?.message ?? 'Invalid request',
        field: issue?.path[0] === 'password' ? 'password' : 'email',
      },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  if (email.toLowerCase() === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "That's already your email", field: 'email' },
      { status: 400 },
    );
  }

  // Guesses at the password count against the same limit as changing it.
  const tries = await checkSharedRateLimit(
    `account-password:${user.id}`,
    RATE_LIMITS.accountPassword,
    { failClosed: true },
  );
  if (!tries.success) return rateLimited(tries);
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

  const { data, error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: new URL(EMAIL_CHANGE_REDIRECT, request.nextUrl.origin).toString() },
  );
  if (error) {
    const refusal = emailRefusal(error.code);
    if (refusal.status >= 500) console.error('Email change failed:', error);
    return NextResponse.json(
      { error: refusal.error, field: refusal.field },
      { status: refusal.status },
    );
  }

  // Waiting for the link, as usual. A project that confirms emails on its own
  // has changed it already.
  return NextResponse.json({
    email: data.user?.email ?? null,
    pendingEmail: data.user?.new_email ?? null,
  });
}
