import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 1: fetch queue rows (no FK to games, so can't use join syntax)
  const { data: queueRows, error } = await supabase
    .from('playing_queue')
    .select('id, app_id, position')
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!queueRows || queueRows.length === 0) {
    return NextResponse.json({ queue: [] });
  }

  // Step 2: fetch game details for those app_ids
  const appIds = queueRows.map((r) => r.app_id);
  const { data: games } = await supabase
    .from('games')
    .select('app_id, name, header_image, playtime_forever, main_story_hours')
    .eq('user_id', user.id)
    .in('app_id', appIds);

  const gamesMap = new Map((games ?? []).map((g) => [g.app_id, g]));

  const queue = queueRows.map((row) => {
    const g = gamesMap.get(row.app_id);
    return {
      id: row.id,
      app_id: row.app_id,
      position: row.position,
      game: {
        name: g?.name ?? '',
        header_image: g?.header_image ?? null,
        playtime_forever: g?.playtime_forever ?? 0,
        main_story_hours: g?.main_story_hours ?? null,
      },
    };
  });

  return NextResponse.json({ queue });
}

export async function POST(request: NextRequest) {
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

  const { appId } = body;

  if (!appId || typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Invalid appId' }, { status: 400 });
  }

  // Get max position for the user's queue
  const { data: maxRow } = await supabase
    .from('playing_queue')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const nextPosition = maxRow ? maxRow.position + 1 : 0;

  const { error } = await supabase.from('playing_queue').insert({
    user_id: user.id,
    app_id: appId,
    position: nextPosition,
  });

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation — game already in queue
      return NextResponse.json({ error: 'Game already in queue' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
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

  const { order } = body;
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'number')) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  }

  // Update each item's position based on its index in the new order
  const updates = order.map((appId: number, index: number) =>
    supabase
      .from('playing_queue')
      .update({ position: index })
      .eq('user_id', user.id)
      .eq('app_id', appId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const appIdParam = searchParams.get('appId');

  if (!appIdParam) {
    return NextResponse.json({ error: 'Missing appId' }, { status: 400 });
  }

  const appId = parseInt(appIdParam, 10);
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Invalid appId' }, { status: 400 });
  }

  const { error } = await supabase
    .from('playing_queue')
    .delete()
    .eq('user_id', user.id)
    .eq('app_id', appId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
