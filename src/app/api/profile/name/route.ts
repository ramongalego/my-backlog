import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { profileNameSchema } from '@/lib/validations/profile';

/**
 * Sets the name the player's profile shows, or clears it (null), which goes
 * back to the Steam name or the email before its @. Profiles are written by
 * the server only, so it's saved with the service client, for this player's
 * row alone.
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

  const service = tryCreateServiceClient();
  if (!service) return jsonError("Couldn't save your name. Please try again.", 500);

  const { error } = await service
    .from('profiles')
    .update({ display_name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error('Saving the profile name failed:', error);
    return jsonError("Couldn't save your name. Please try again.", 500);
  }

  return NextResponse.json({ name: parsed.data.name });
}
