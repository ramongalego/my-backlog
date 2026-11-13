import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { gameIdSchema } from '@/lib/validations/common';
import { gameArtSchema } from '@/lib/validations/games';
import { chooseArt, originalArt, type GameArtColumns } from '@/lib/games/art';
import { parseReleaseDate } from '@/lib/games/release-date';
import { listWideArt } from '@/lib/steamgriddb/api';

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

/**
 * The art a player can choose for one of their games: SteamGridDB's wide
 * images for it, and the art it has without a choice (`original`).
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

  const parsed = gameIdSchema.safeParse(Number(new URL(request.url).searchParams.get('gameId')));
  if (!parsed.success) return jsonError('Invalid gameId', 400);

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

  const released = parseReleaseDate(game.release_date);
  const choices = await listWideArt({
    name: game.name,
    year: released ? new Date(released).getUTCFullYear() : null,
    // A Steam game's own id, or the Steam id of a console game Steam also sells.
    steamAppId: game.source === 'steam' ? game.app_id : game.steam_app_id,
  });
  if (!choices) return jsonError("Couldn't reach SteamGridDB. Try again in a moment.", 502);

  const original = originalArt(game);
  return NextResponse.json({
    original,
    current: game.header_image,
    // The original has its own tile, so it isn't listed twice.
    choices: choices.filter((choice) => choice.url !== original),
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
