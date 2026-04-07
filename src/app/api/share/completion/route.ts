import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`share:${ip}`, RATE_LIMITS.gameStatus);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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

  const {
    gameName,
    headerImage,
    playtimeMinutes,
    mainStoryHours,
    rating,
    gamesFinished,
    totalGames,
    backlogHoursRemoved,
    nextGame,
  } = body;

  if (!gameName || typeof gameName !== 'string') {
    return NextResponse.json({ error: 'Game name is required' }, { status: 400 });
  }

  const id = nanoid(10);

  const { error } = await supabase.from('shared_completions').insert({
    id,
    game_name: gameName,
    header_image: headerImage ?? null,
    playtime_minutes: playtimeMinutes ?? 0,
    main_story_hours: mainStoryHours ?? null,
    rating: rating ?? null,
    games_finished: gamesFinished ?? 0,
    total_games: totalGames ?? 0,
    backlog_hours_removed: backlogHoursRemoved ?? null,
    next_game: nextGame ?? null,
  });

  if (error) {
    console.error('Failed to save shared completion:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ id, url: `/share/completion/${id}` });
}
