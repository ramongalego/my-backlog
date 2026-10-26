import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { addManualGameSchema } from '@/lib/validations/games';
import { getGameDetails } from '@/lib/igdb/api';
import { getMainStoryHours } from '@/lib/hltb/api';
import { applyStatusChange } from '@/lib/games/apply-status';

// HowLongToBeat can be slow or refusing; the game is added either way.
const HLTB_WAIT_MS = 10_000;

async function mainStoryHours(name: string): Promise<number | null> {
  try {
    return await Promise.race([
      getMainStoryHours(name),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), HLTB_WAIT_MS)),
    ]);
  } catch {
    return null;
  }
}

/**
 * Adds a game that isn't from Steam (a console game, another store) to the
 * library. Its details come from IGDB on the server, never from the request,
 * and its time to beat from HowLongToBeat.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const rateLimitResult = checkRateLimit(`game-add:${user.id}`, RATE_LIMITS.gameAdd);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = addManualGameSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  const { igdbId, platform, status, hoursPlayed } = parsed.data;

  let details;
  try {
    details = await getGameDetails(igdbId);
  } catch (err) {
    console.error(err);
    return jsonError('Game search is unavailable right now', 503);
  }
  if (!details) return jsonError('Game not found', 404);

  const { data: game, error } = await supabase
    .from('games')
    .insert({
      user_id: user.id,
      source: 'manual',
      igdb_id: igdbId,
      platform,
      type: 'game',
      name: details.name,
      genres: details.genres,
      categories: details.categories,
      tags: details.tags,
      description: details.description,
      release_date: details.release_date,
      header_image: details.header_image,
      main_story_hours: await mainStoryHours(details.name),
      playtime_forever: Math.round((hoursPlayed ?? 0) * 60),
      metadata_synced: true,
      status: 'backlog',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505')
      return jsonError(`It's already in your library on ${platform}`, 409);
    console.error(error);
    return jsonError('Failed to add the game', 500);
  }

  if (status === 'playing') {
    const started = await applyStatusChange(supabase, user.id, {
      gameId: game.id,
      status: 'playing',
    });
    if (!started.ok) console.error(`Added game ${game.id} but couldn't start it: ${started.error}`);
  } else if (status === 'queue') {
    const { data: last } = await supabase
      .from('playing_queue')
      .select('position')
      .eq('user_id', user.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error: queueError } = await supabase
      .from('playing_queue')
      .insert({ user_id: user.id, game_id: game.id, position: last ? last.position + 1 : 0 });
    if (queueError) console.error(queueError);
  }

  return NextResponse.json({ id: game.id, name: details.name });
}
