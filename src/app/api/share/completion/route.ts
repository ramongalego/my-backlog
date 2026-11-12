import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { safeShareImage } from '@/lib/share/image';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { tryCreateServiceClient } from '@/lib/supabase/service';

const shareSchema = z.object({
  gameName: z.string().trim().min(1).max(200),
  // Checked below (safeShareImage): art from anywhere else is left off.
  headerImage: z.string().max(1000).nullish(),
  playtimeMinutes: z.number().int().min(0).max(10_000_000).default(0),
  mainStoryHours: z.number().min(0).max(10_000).nullish(),
  rating: z.number().int().min(0).max(10).nullish(),
  gamesFinished: z.number().int().min(0).max(1_000_000).default(0),
  totalGames: z.number().int().min(0).max(1_000_000).default(0),
  backlogHoursRemoved: z.number().min(0).max(1_000_000).nullish(),
  nextGame: z.string().trim().max(200).nullish(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Share pages are public, on our domain: counted per user, across servers.
  const rateLimitResult = await checkSharedRateLimit(`share:${user.id}`, RATE_LIMITS.share);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const id = nanoid(21);

  // Written with the server's key: users can't insert share pages themselves,
  // so the checks above (and the generated id) can't be skipped.
  const service = tryCreateServiceClient();
  if (!service) {
    console.error('SUPABASE_SECRET_KEY not configured; cannot save share pages');
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
  const { error } = await service.from('shared_completions').insert({
    id,
    user_id: user.id,
    game_name: parsed.data.gameName,
    header_image: safeShareImage(parsed.data.headerImage),
    playtime_minutes: parsed.data.playtimeMinutes,
    main_story_hours: parsed.data.mainStoryHours ?? null,
    rating: parsed.data.rating ?? null,
    games_finished: parsed.data.gamesFinished,
    total_games: parsed.data.totalGames,
    backlog_hours_removed: parsed.data.backlogHoursRemoved ?? null,
    next_game: parsed.data.nextGame ?? null,
  });

  if (error) {
    console.error('Failed to save shared completion:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ id, url: `/share/completion/${id}` });
}
