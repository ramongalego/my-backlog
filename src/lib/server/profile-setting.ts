import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';

const FAILED = "Couldn't save that. Please try again.";

/**
 * A setting kept on the player's own profile row, saved as the body `schema`
 * allows and answered with that same body. Profiles are written by the server
 * only, so the service client saves this player's row, and only the columns
 * `toRow` gives.
 */
export async function saveProfileSetting<T extends Record<string, unknown>>(
  request: NextRequest,
  {
    schema,
    toRow,
    what,
  }: {
    schema: z.ZodType<T>;
    toRow: (body: T) => Record<string, unknown>;
    /** For the log: "Saving <what> failed". */
    what: string;
  },
) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request', 400);

  const service = tryCreateServiceClient();
  if (!service) return jsonError(FAILED, 500);

  const { error } = await service
    .from('profiles')
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error(`Saving ${what} failed:`, error);
    return jsonError(FAILED, 500);
  }

  return NextResponse.json(parsed.data);
}
