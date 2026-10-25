import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { gameStatusSchema } from '@/lib/validations/games';
import { applyStatusChange } from '@/lib/games/apply-status';

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

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  // Get now playing game
  const { data, error } = await supabase
    .from('games')
    .select('app_id, name, header_image, main_story_hours')
    .eq('user_id', user.id)
    .eq('status', 'playing')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return jsonError('Failed to load current game', 500);
  }

  return NextResponse.json({ game: data });
}
