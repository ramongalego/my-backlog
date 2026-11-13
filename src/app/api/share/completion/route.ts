import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { safeShareImage } from '@/lib/share/image';
import { gameIdSchema } from '@/lib/validations/common';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { fetchCompletionCounts } from '@/lib/server/completion-counts';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { tryCreateServiceClient } from '@/lib/supabase/service';

const shareSchema = z.object({ gameId: gameIdSchema });

/**
 * Creates a public share page for a game the player has finished. Everything
 * on the page is read here, from their library: the browser only says which
 * game. Otherwise anyone signed in could publish any text and picture on a
 * page of this site.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError('Unauthorized', 401);

  // Share pages are public, on our domain: counted per user, across servers.
  const rateLimitResult = await checkSharedRateLimit(`share:${user.id}`, RATE_LIMITS.share);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request', 400);
  const { gameId } = parsed.data;

  const [finished, counts, playing] = await Promise.all([
    supabase
      .from('games')
      .select('name, header_image, playtime_forever, main_story_hours, rating, status')
      .eq('user_id', user.id)
      .eq('id', gameId)
      .maybeSingle(),
    fetchCompletionCounts(supabase, user.id),
    // Finishing a game starts the next one in the queue: that's "Next up".
    supabase
      .from('games')
      .select('name, header_image')
      .eq('user_id', user.id)
      .eq('status', 'playing')
      .neq('id', gameId)
      .limit(1)
      .maybeSingle(),
  ]);
  if (finished.error) {
    console.error('Failed to read the game to share:', finished.error);
    return jsonError('Failed to save', 500);
  }
  const game = finished.data;
  if (!game || game.status !== 'finished') return jsonError('Game not found', 404);

  const id = nanoid(21);
  const hours = (game.main_story_hours ?? 0) > 0 ? game.main_story_hours : null;

  // Written with the server's key: users can't insert share pages themselves,
  // so the checks above (and the generated id) can't be skipped.
  const service = tryCreateServiceClient();
  if (!service) {
    console.error('SUPABASE_SECRET_KEY not configured; cannot save share pages');
    return jsonError('Failed to save', 500);
  }
  const { error } = await service.from('shared_completions').insert({
    id,
    user_id: user.id,
    game_name: game.name,
    // Art from anywhere but a game-art host is left off (see safeShareImage).
    header_image: safeShareImage(game.header_image),
    playtime_minutes: game.playtime_forever ?? 0,
    main_story_hours: hours,
    rating: game.rating ?? null,
    games_finished: counts.gamesFinished,
    total_games: counts.totalGames,
    backlog_hours_removed: hours,
    next_game: playing.data?.name ?? null,
    next_game_image: safeShareImage(playing.data?.header_image),
  });

  if (error) {
    console.error('Failed to save shared completion:', error);
    return jsonError('Failed to save', 500);
  }

  return NextResponse.json({ id, url: `/share/completion/${id}` });
}
