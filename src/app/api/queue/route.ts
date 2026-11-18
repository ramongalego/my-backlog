import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { undoAgoSeconds } from '@/lib/server/apply-status';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import {
  queueAddRequestSchema,
  queueReorderRequestSchema,
  gameIdSchema,
} from '@/lib/validations/common';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(`queue-write:${user.id}`, RATE_LIMITS.queueWrite);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = queueAddRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid gameId', 400);
  }
  const { gameId, undoAgoMs } = parsed.data;

  // An Undo goes through add_to_queue, which tells the history it's one, so
  // off and back leaves nothing however long the toast waited. Without that
  // function (migration not applied), it's added the ordinary way below.
  if (undoAgoMs !== undefined) {
    const { error: undoError } = await supabase.rpc('add_to_queue', {
      p_game_id: gameId,
      p_undo_ago: undoAgoSeconds(undoAgoMs),
    });
    if (!undoError) return NextResponse.json({ success: true });
    if (undoError.code === '23503') return jsonError('Game not found', 404);
    if (undoError.code !== 'PGRST202' && undoError.code !== '42883') {
      console.error(undoError);
      return jsonError('Failed to add to queue', 500);
    }
  }

  // Two adds at once can read the same max and share a position (it isn't
  // unique); the next reorder renumbers it.
  const { data: maxRow, error: maxError } = await supabase
    .from('playing_queue')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) {
    console.error(maxError);
    return jsonError('Failed to add to queue', 500);
  }

  const nextPosition = maxRow ? maxRow.position + 1 : 0;

  const { error } = await supabase.from('playing_queue').insert({
    user_id: user.id,
    game_id: gameId,
    position: nextPosition,
  });

  if (error) {
    if (error.code === '23505') {
      // Queued already (added twice, or from another tab): it's where it was
      // asked to be, so that's a success, not an error to show.
      return NextResponse.json({ success: true });
    }
    if (error.code === '23503') {
      // Foreign key violation: not one of the user's games.
      return jsonError('Game not found', 404);
    }
    console.error(error);
    return jsonError('Failed to add to queue', 500);
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(`queue-write:${user.id}`, RATE_LIMITS.queueWrite);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = queueReorderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  }
  const { order } = parsed.data;

  const { error } = await supabase.rpc('reorder_queue', { p_game_ids: order });

  if (error) {
    // P0001 and 22023 are the function's own validation errors; anything else
    // is a server problem.
    if (error.code === 'P0001' || error.code === '22023') {
      return jsonError(error.message, 400);
    }
    console.error(error);
    return jsonError('Failed to reorder queue', 500);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(`queue-write:${user.id}`, RATE_LIMITS.queueWrite);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  const { searchParams } = new URL(request.url);
  const gameIdParam = searchParams.get('gameId');

  if (!gameIdParam) {
    return jsonError('Missing gameId', 400);
  }

  const parsedGameId = gameIdSchema.safeParse(Number(gameIdParam));
  if (!parsedGameId.success) {
    return jsonError('Invalid gameId', 400);
  }
  const gameId = parsedGameId.data;

  const { error } = await supabase
    .from('playing_queue')
    .delete()
    .eq('user_id', user.id)
    .eq('game_id', gameId);

  if (error) {
    console.error(error);
    return jsonError('Failed to remove from queue', 500);
  }

  return NextResponse.json({ success: true });
}
