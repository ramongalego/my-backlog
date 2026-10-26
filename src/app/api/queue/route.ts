import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsonError } from '@/lib/api/response';
import { loadQueue } from '@/lib/data/loaders';
import {
  queueAddRequestSchema,
  queueReorderRequestSchema,
  gameIdSchema,
} from '@/lib/validations/common';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const queue = await loadQueue(supabase, user.id);
    return NextResponse.json({ queue }, { headers: { 'Cache-Control': 'private, no-cache' } });
  } catch (error) {
    console.error(error);
    return jsonError('Failed to load queue', 500);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

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
  const { gameId } = parsed.data;

  // Get max position for the user's queue
  const { data: maxRow } = await supabase
    .from('playing_queue')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = maxRow ? maxRow.position + 1 : 0;

  const { error } = await supabase.from('playing_queue').insert({
    user_id: user.id,
    game_id: gameId,
    position: nextPosition,
  });

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation — game already in queue
      return jsonError('Game already in queue', 409);
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
    // Postgres raise_exception (P0001) for our validation errors → 400.
    // Everything else is a real server problem → log + 500.
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
