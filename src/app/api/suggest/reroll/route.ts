import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { rerollRequestSchema } from '@/lib/validations/common';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(
    `suggestion-reroll:${user.id}`,
    RATE_LIMITS.suggestionReroll,
  );
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = rerollRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid gameId', 400);
  }
  const { gameId } = parsed.data;

  // Counts the reroll and stamps it, so the penalty fades (see record_game_reroll).
  const { error } = await supabase.rpc('record_game_reroll', { p_game_id: gameId });

  if (error) {
    console.error('Failed to record reroll:', error);
    // Non-critical error, don't fail the request
  }

  return NextResponse.json({ success: true });
}
