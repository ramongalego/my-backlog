import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { gameIdSchema } from '@/lib/validations/common';
import { gameArtSchema } from '@/lib/validations/games';
import { chooseArt, originalArt, type GameArtColumns } from '@/lib/games/art';
import { parseReleaseDate } from '@/lib/games/release-date';
import { listWideArt } from '@/lib/steamgriddb/api';
import { getAddableGameDetails } from '@/lib/server/manual-details';

interface ArtGame extends GameArtColumns {
  id: number;
  name: string;
  source: string;
  app_id: number | null;
  steam_app_id: number | null;
  release_date: string | null;
}

const ART_GAME_COLUMNS =
  'id, name, source, app_id, steam_app_id, release_date, header_image, art_chosen, default_header_image';

/** `original` is the art the game has without a choice. */
interface ArtSubject {
  name: string;
  release_date: string | null;
  /** A Steam game's own id, or the Steam id of a console game Steam also sells. */
  steamAppId: number | null;
  original: string | null;
  current: string | null;
}

/**
 * For one of the player's games (`?gameId=`) or one being added (`?igdbId=`),
 * whose pick is saved with the game when it's added.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  // Per user, and counted across servers: each call asks SteamGridDB with the
  // app's key, which every player shares.
  const limit = await checkSharedRateLimit(`game-art:${user.id}`, RATE_LIMITS.gameArt);
  if (!limit.success) return rateLimited(limit);

  const params = new URL(request.url).searchParams;
  const adding = params.has('igdbId');
  const parsed = gameIdSchema.safeParse(Number(params.get(adding ? 'igdbId' : 'gameId')));
  if (!parsed.success) return jsonError(adding ? 'Invalid igdbId' : 'Invalid gameId', 400);

  let subject: ArtSubject;
  if (adding) {
    // The same details the Add game dialog shows and the add route saves.
    let details;
    try {
      details = await getAddableGameDetails(parsed.data);
    } catch (err) {
      console.error(err);
      return jsonError('Game search is unavailable right now', 503);
    }
    if (!details) return jsonError('Game not found', 404);
    subject = {
      name: details.name,
      release_date: details.release_date,
      steamAppId: details.steam_app_id,
      original: details.header_image,
      current: details.header_image,
    };
  } else {
    const { data: game, error } = await supabase
      .from('games')
      .select(ART_GAME_COLUMNS)
      .eq('user_id', user.id)
      .eq('id', parsed.data)
      .maybeSingle<ArtGame>();
    if (error) {
      console.error(error);
      return jsonError('Failed to read the game', 500);
    }
    if (!game) return jsonError('Game not found', 404);
    subject = {
      name: game.name,
      release_date: game.release_date,
      steamAppId: game.source === 'steam' ? game.app_id : game.steam_app_id,
      original: originalArt(game),
      current: game.header_image,
    };
  }

  const released = parseReleaseDate(subject.release_date);
  const choices = await listWideArt({
    name: subject.name,
    year: released ? new Date(released).getUTCFullYear() : null,
    steamAppId: subject.steamAppId,
  });
  if (!choices) return jsonError("Couldn't reach SteamGridDB. Try again in a moment.", 502);

  return NextResponse.json({
    original: subject.original,
    current: subject.current,
    // The original has its own tile, so it isn't listed twice.
    choices: choices.filter((choice) => choice.url !== subject.original),
  });
}

/** Saves the art a player picked for a game, or (`url: null`) goes back to the original. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = checkRateLimit(`game-art-save:${user.id}`, RATE_LIMITS.gameArt);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = gameArtSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request', 400);
  const { gameId, url } = parsed.data;

  const { data: game, error } = await supabase
    .from('games')
    .select('header_image, art_chosen, default_header_image')
    .eq('user_id', user.id)
    .eq('id', gameId)
    .maybeSingle<GameArtColumns>();
  if (error) {
    console.error(error);
    return jsonError('Failed to read the game', 500);
  }
  if (!game) return jsonError('Game not found', 404);

  const art = chooseArt(game, url);
  if (!art) return jsonError('That image can’t be used', 400);

  const { error: saveError } = await supabase
    .from('games')
    .update(art)
    .eq('user_id', user.id)
    .eq('id', gameId);
  if (saveError) {
    console.error(saveError);
    return jsonError('Failed to save the art', 500);
  }

  return NextResponse.json({ header_image: art.header_image });
}
