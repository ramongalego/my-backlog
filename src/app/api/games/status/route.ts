import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { gameStatusSchema } from '@/lib/validations/games';

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

  const { appId, status, finishedAt, droppedAt, notes, rating } = parsed.data;

  // If setting to "playing", first clear any other "playing" games
  if (status === 'playing') {
    await supabase
      .from('games')
      .update({ status: 'backlog' })
      .eq('user_id', user.id)
      .eq('status', 'playing');
  }

  // Build update payload based on status
  type GameUpdate = {
    status: string;
    started_at?: string | null;
    finished_at?: string | null;
    dropped_at?: string | null;
    notes?: string | null;
    rating?: number | null;
  };

  const updatePayload: GameUpdate = { status };

  if (status === 'playing') {
    updatePayload.started_at = new Date().toISOString();
  } else if (status === 'backlog') {
    updatePayload.started_at = null;
  } else if (status === 'finished') {
    updatePayload.finished_at = finishedAt || null;
    updatePayload.notes = notes ?? null;
    updatePayload.rating = rating ?? null;
  } else if (status === 'dropped') {
    updatePayload.dropped_at = droppedAt || null;
    updatePayload.notes = notes ?? null;
    updatePayload.rating = rating ?? null;
  } else if (status === 'wont_play' || status === 'hidden') {
    updatePayload.started_at = null;
    updatePayload.finished_at = null;
    updatePayload.dropped_at = null;
    updatePayload.notes = null;
    updatePayload.rating = null;
  }

  // Update the game status
  const { error } = await supabase
    .from('games')
    .update(updatePayload)
    .eq('user_id', user.id)
    .eq('app_id', appId);

  if (error) {
    Sentry.captureException(error);
    return jsonError('Failed to update game status', 500);
  }

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
  const { data } = await supabase
    .from('games')
    .select('app_id, name, header_image, main_story_hours')
    .eq('user_id', user.id)
    .eq('status', 'playing')
    .maybeSingle();

  return NextResponse.json({ game: data });
}
