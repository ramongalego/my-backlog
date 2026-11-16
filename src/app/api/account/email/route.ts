import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { emailRefusal } from '@/lib/server/account';
import { changeEmailSchema } from '@/lib/validations/auth';

/**
 * Where a confirmation link lands: the auth callback, which knows this flow
 * by its name and goes on to the profile.
 */
const EMAIL_CHANGE_REDIRECT = '/auth/callback?flow=email-change&next=/profile';

/**
 * Starts changing the signed-in player's email. Supabase emails a link to
 * confirm it (with secure email change on, one to each address), and the
 * email only changes once that's done; until then it's the account's
 * `new_email`, which the profile shows as waiting.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = await checkSharedRateLimit(`account-email:${user.id}`, RATE_LIMITS.accountEmail);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = changeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', field: 'email' },
      { status: 400 },
    );
  }
  const { email } = parsed.data;

  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "That's already your email", field: 'email' },
      { status: 400 },
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
