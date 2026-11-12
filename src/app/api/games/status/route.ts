import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { gameStatusSchema } from '@/lib/validations/games';
import { applyStatusChange } from '@/lib/server/apply-status';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  // Rate limiting per user (not IP) — this is an authenticated endpoint, so a
  // per-user quota avoids throttling unrelated users behind a shared NAT/IP.
  const rateLimitResult = checkRateLimit(`game-status:${user.id}`, RATE_LIMITS.gameStatus);
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = gameStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  }

  const result = await applyStatusChange(supabase, user.id, parsed.data);
  if (!result.ok) return jsonError(result.error, result.status);

  return NextResponse.json({ success: true, paused: result.paused });
}
