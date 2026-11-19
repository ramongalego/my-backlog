import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';

const FAILED = "Couldn't save that. Please try again.";

const privacySchema = z.object({ private: z.boolean() });

/**
 * Whether the player's profile can be seen by other people (/u/<username>).
 * Profiles are written by the server only, so the service client saves this
 * player's row. The page reads it afresh on every visit, so a profile made
 * private is gone for visitors at once.
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
  const parsed = privacySchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request', 400);

  const service = tryCreateServiceClient();
  if (!service) return jsonError(FAILED, 500);

  const { error } = await service
    .from('profiles')
    .update({ is_private: parsed.data.private, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error('Saving the profile visibility failed:', error);
    return jsonError(FAILED, 500);
  }

  return NextResponse.json({ private: parsed.data.private });
}
