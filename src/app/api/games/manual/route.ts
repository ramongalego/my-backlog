import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { addManualGameSchema } from '@/lib/validations/games';
import { getGameDetails } from '@/lib/igdb/api';
import { getMainStoryHours } from '@/lib/hltb/api';
import { applyStatusChange } from '@/lib/games/apply-status';
import { DEMOTED } from '@/lib/games/status-rules';
import { STEAM_PLATFORM } from '@/lib/games/consoles';

const STATUS_WORDS = {
  backlog: 'as backlog',
  playing: 'as playing',
  finished: 'finished',
  dropped: 'dropped',
} as const;

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
  const { igdbId, platform, status, hoursPlayed, date, notes, rating } = parsed.data;

  let details;
  try {
    details = await getGameDetails(igdbId);
  } catch (err) {
    console.error(err);
    return jsonError('Game search is unavailable right now', 503);
  }
  if (!details) return jsonError('Game not found', 404);

  // Already in your Steam library: move that entry to this console rather than
  // listing the game twice. It keeps its Steam details, history and place in
  // the queue; the hours become the ones you enter here (Steam's are for PC).
  let steamGame: { id: number; name: string; status: string } | null = null;
  if (details.steamAppIds.length) {
    const { data, error: lookupError } = await supabase
      .from('games')
      .select('id, name, status')
      .eq('user_id', user.id)
      .eq('source', 'steam')
      .in('app_id', details.steamAppIds)
      .limit(1)
      .maybeSingle();
    if (lookupError) {
      console.error(lookupError);
      return jsonError('Failed to add the game', 500);
    }
    steamGame = data;
  }
  if (steamGame && platform === STEAM_PLATFORM)
    return jsonError("It's already in your Steam library. Pick the console you play it on.", 400);

  const { data: game, error } = steamGame
    ? await supabase
        .from('games')
        .update({
          platform,
          igdb_id: igdbId,
          playtime_forever: Math.round((hoursPlayed ?? 0) * 60),
          // Steam's last-played date is for the PC copy; the next sync after
          // moving it back to Steam restores it.
          last_played_at: null,
        })
        .eq('user_id', user.id)
        .eq('id', steamGame.id)
        .select('id')
        .single()
    : await supabase
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

  // The game is in the library either way; if putting it where it was asked
  // for fails, say so rather than reporting plain success.
  const name = steamGame?.name ?? details.name;
  const where = steamGame ? `Moved to ${platform}` : 'Added to your backlog';
  let warning: string | undefined;
  // A moved Steam game keeps its status unless you changed it (restarting
  // "playing" would reset when you started it); finished and dropped always
  // save, since the dialog shows their date, notes and rating to edit.
  const statusChanged = !steamGame || steamGame.status !== status;
  if (
    status === 'finished' ||
    status === 'dropped' ||
    (status === 'playing' && statusChanged) ||
    (status === 'backlog' && steamGame && statusChanged)
  ) {
    // The same rules as any status change: starting it moves another playing
    // game back to the backlog; finishing or dropping records date and review.
    const applied = await applyStatusChange(supabase, user.id, {
      gameId: game.id,
      status,
      ...(status === 'finished' ? { finishedAt: date } : {}),
      ...(status === 'dropped' ? { droppedAt: date } : {}),
      notes,
      rating,
    });
    if (!applied.ok) {
      console.error(`Added game ${game.id} but couldn't set it to ${status}: ${applied.error}`);
      warning = `${where}, but it couldn't be marked ${STATUS_WORDS[status]}. Open it to try again.`;
    }
  } else if (status === 'queue') {
    // A Steam game you're moving may be queued already.
    const { data: queued } = await supabase
      .from('playing_queue')
      .select('game_id')
      .eq('user_id', user.id)
      .eq('game_id', game.id)
      .maybeSingle();
    const { data: last } = await supabase
      .from('playing_queue')
      .select('position')
      .eq('user_id', user.id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    // Only backlog games are queued.
    const { error: backlogError } = steamGame
      ? await supabase.from('games').update(DEMOTED).eq('user_id', user.id).eq('id', game.id)
      : { error: null };
    const { error: queueError } =
      (backlogError ?? queued)
        ? { error: backlogError }
        : await supabase
            .from('playing_queue')
            .insert({ user_id: user.id, game_id: game.id, position: last ? last.position + 1 : 0 });
    if (queueError) {
      console.error(queueError);
      warning = `${where}, but it couldn't be queued. Open it to try again.`;
    }
  }

  return NextResponse.json({ id: game.id, name, warning, movedFromSteam: !!steamGame });
}
