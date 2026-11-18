import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { addManualGameSchema } from '@/lib/validations/games';
import { getAddableGameDetails } from '@/lib/server/manual-details';
import { getMainStoryHours } from '@/lib/hltb/api';
import { applyStatusChange } from '@/lib/server/apply-status';
import { DEMOTED } from '@/lib/games/status-rules';
import {
  knownConsole,
  playsOnConsole,
  shortPlatformName,
  STEAM_PLATFORM,
} from '@/lib/games/consoles';
import { releaseYear } from '@/lib/games/release-date';
import { chooseArt } from '@/lib/games/art';

const STATUS_WORDS = {
  backlog: 'as backlog',
  playing: 'as playing',
  finished: 'finished',
  dropped: 'dropped',
} as const;

// HowLongToBeat can be slow or refusing; the game is added either way.
const HLTB_WAIT_MS = 10_000;

async function mainStoryHours(name: string, year: number | null): Promise<number | null> {
  try {
    return await Promise.race([
      getMainStoryHours(name, year),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), HLTB_WAIT_MS)),
    ]);
  } catch {
    return null;
  }
}

/** A game's details come from IGDB and Steam on the server, never from the request. */
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
  const { igdbId, status, hoursPlayed, date, notes, rating, art } = parsed.data;

  let details;
  try {
    details = await getAddableGameDetails(igdbId);
  } catch (err) {
    console.error(err);
    return jsonError('Game search is unavailable right now', 503);
  }
  if (!details) return jsonError('Game not found', 404);

  // A typed console that matches a known one ("switch 2") is saved under that
  // name, or the filters would list one console twice.
  const typed = parsed.data.platform.replace(/\s+/g, ' ').trim();
  const platform =
    knownConsole(typed, details.platforms.map(shortPlatformName)) ??
    knownConsole(typed, await consolesInLibrary(supabase, user.id)) ??
    typed;

  // A game already in the Steam library moves to this console rather than
  // being listed twice; its hours become the ones entered (Steam's are for PC).
  let steamGame: { id: number; name: string; status: string; platform: string | null } | null =
    null;
  if (details.steamAppIds.length) {
    const { data, error: lookupError } = await supabase
      .from('games')
      .select('id, name, status, platform')
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

  // A game is one entry, so one already added by hand moves to the picked
  // console. Its hours stay unless new ones were entered.
  let manualGame: { id: number; name: string; status: string } | null = null;
  if (!steamGame) {
    const { data, error: lookupError } = await supabase
      .from('games')
      .select('id, name, status')
      .eq('user_id', user.id)
      .eq('source', 'manual')
      .eq('igdb_id', igdbId)
      .order('id')
      .limit(1)
      .maybeSingle();
    if (lookupError) {
      console.error(lookupError);
      return jsonError('Failed to add the game', 500);
    }
    manualGame = data;
  }
  const existing = steamGame ?? manualGame;

  const ownArt = {
    header_image: details.header_image,
    art_chosen: false,
    default_header_image: null,
  };
  const newArt = art && !existing ? chooseArt(ownArt, art) : ownArt;
  if (!newArt) return jsonError('That image can’t be used', 400);

  // The year tells a remake from the original it shares a title with.
  const mainStory = existing
    ? null
    : await mainStoryHours(details.name, releaseYear(details.release_date));

  const enteredHours =
    hoursPlayed !== undefined ? { playtime_forever: Math.round(hoursPlayed * 60) } : {};
  // A Steam game moved to a console earlier holds the console's hours and
  // last-played date, so blank hours here keep them.
  const alreadyOnConsole = playsOnConsole(steamGame?.platform);

  const { data: game, error } = steamGame
    ? await supabase
        .from('games')
        .update(
          alreadyOnConsole
            ? { platform, igdb_id: igdbId, ...enteredHours }
            : {
                platform,
                igdb_id: igdbId,
                playtime_forever: Math.round((hoursPlayed ?? 0) * 60),
                // Steam's date is for the PC copy; the next sync after moving
                // it back to Steam restores it.
                last_played_at: null,
              },
        )
        .eq('user_id', user.id)
        .eq('id', steamGame.id)
        .select('id')
        .single()
    : manualGame
      ? await supabase
          .from('games')
          .update({ platform, ...enteredHours })
          .eq('user_id', user.id)
          .eq('id', manualGame.id)
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
            ...newArt,
            critic_score: details.critic_score,
            critic_count: details.critic_count,
            steam_app_id: details.steam_app_id,
            steam_review_score: details.steam_review_score,
            steam_review_count: details.steam_review_count,
            steam_review_weighted: details.steam_review_weighted,
            main_story_hours: mainStory,
            // recheckManualHours looks again in a week, or sooner without a time.
            ...(mainStory !== null ? { hltb_checked_at: new Date().toISOString() } : {}),
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

  // The game is saved either way; a status that couldn't be set is a warning,
  // not plain success.
  const name = existing?.name ?? details.name;
  const where = existing ? `Moved to ${platform}` : 'Added to your backlog';
  let warning: string | undefined;
  // An unchanged "playing" isn't saved again, as that would reset its start
  // date; finished and dropped always save their date, notes and rating.
  const statusChanged = !existing || existing.status !== status;
  if (
    status === 'finished' ||
    status === 'dropped' ||
    (status === 'playing' && statusChanged) ||
    (status === 'backlog' && existing && statusChanged)
  ) {
    // Starting it pauses another playing game to the top of the queue, as
    // switching does everywhere.
    const applied = await applyStatusChange(supabase, user.id, {
      gameId: game.id,
      status,
      ...(status === 'playing' ? { pausePlaying: true } : {}),
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
    // A game you're moving may be queued already.
    const [{ data: queued }, { data: last }] = await Promise.all([
      supabase
        .from('playing_queue')
        .select('game_id')
        .eq('user_id', user.id)
        .eq('game_id', game.id)
        .maybeSingle(),
      supabase
        .from('playing_queue')
        .select('position')
        .eq('user_id', user.id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    // Only backlog games are queued.
    const { error: backlogError } = existing
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

  return NextResponse.json({ id: game.id, name, warning, moved: !!existing });
}

/** On a failed read it returns none, and the typed console is saved as typed. */
async function consolesInLibrary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('games')
    .select('platform')
    .eq('user_id', userId)
    .neq('platform', STEAM_PLATFORM);
  if (error) {
    console.error('Reading the consoles in the library failed:', error);
    return [];
  }
  const names = (data ?? []).map((row: { platform: string | null }) => row.platform);
  return [...new Set(names.filter((name): name is string => !!name))];
}
