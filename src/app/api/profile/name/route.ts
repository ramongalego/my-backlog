import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { profileNameSchema } from '@/lib/validations/profile';

const FAILED = "Couldn't save your name. Please try again.";

/**
 * null goes back to the Steam name or the email before its @. Profiles are
 * written by the server only, and the database decides whether a name can be
 * shown to others (set_display_name): not an offensive one, nor one that
 * passes for the app's staff.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = checkRateLimit(`profile-write:${user.id}`, RATE_LIMITS.profileWrite);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = profileNameSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  const { name } = parsed.data;

  const service = tryCreateServiceClient();
  if (!service) return jsonError(FAILED, 500);

  const { data: answer, error } = await service.rpc('set_display_name', {
    p_user: user.id,
    p_name: name,
  });
  if (error) {
    console.error('Saving the profile name failed:', error);
    return jsonError(FAILED, 500);
  }

  switch (answer) {
    case 'ok':
      return NextResponse.json({ name });
    case 'refused':
      return jsonError("That name isn't available", 400);
    default:
      // 'invalid' (longer than the schema let through), 'no_profile', or an
      // answer this code doesn't know.
      console.error('Saving the profile name failed: set_display_name answered', answer);
      return jsonError(FAILED, 500);
  }
}
