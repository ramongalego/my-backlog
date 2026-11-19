import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { usernameSchema } from '@/lib/validations/profile';

const FAILED = "Couldn't save your username. Please try again.";

/** About the username itself: said under its field. */
const refused = (error: string, status: number) =>
  NextResponse.json({ error, field: 'username' }, { status });

/**
 * The database decides (claim_username): whether it's taken or reserved is
 * checked and saved in one step, so two players can't both get one username.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = checkRateLimit(`username:${user.id}`, RATE_LIMITS.usernameChange);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    return refused(parsed.error.issues[0]?.message ?? 'Enter a username', 400);
  }
  const { username } = parsed.data;

  const service = tryCreateServiceClient();
  if (!service) return jsonError(FAILED, 500);

  const { data: answer, error } = await service.rpc('claim_username', {
    p_user: user.id,
    p_username: username,
  });
  if (error) {
    console.error('Saving the username failed:', error);
    return jsonError(FAILED, 500);
  }

  switch (answer) {
    case 'ok':
      return NextResponse.json({ username });
    case 'taken':
      return refused('That username is taken', 409);
    case 'reserved':
      return refused("That username isn't available", 409);
    case 'invalid':
      return refused('Use only letters, numbers, - and _', 400);
    default:
      // 'no_profile', or an answer this code doesn't know.
      console.error('Saving the username failed: claim_username answered', answer);
      return jsonError(FAILED, 500);
  }
}
