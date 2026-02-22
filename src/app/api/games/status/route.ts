import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`game-status:${ip}`, RATE_LIMITS.gameStatus);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { appId, status, finishedAt, droppedAt, notes, rating } = body;

  if (!appId || typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Invalid appId' }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ error: 'Missing status' }, { status: 400 });
  }

  const validStatuses = ['backlog', 'playing', 'finished', 'dropped', 'hidden'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (rating !== undefined && rating !== null) {
    if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }
  }

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
  }

  // Update the game status
  const { error } = await supabase
    .from('games')
    .update(updatePayload)
    .eq('user_id', user.id)
    .eq('app_id', appId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get currently playing game
  const { data } = await supabase
    .from('games')
    .select('app_id, name, header_image, main_story_hours')
    .eq('user_id', user.id)
    .eq('status', 'playing')
    .single();

  return NextResponse.json({ game: data });
}
