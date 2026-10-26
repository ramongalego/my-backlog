import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { gameIdSchema } from '@/lib/validations/common';
import { updateManualGameSchema } from '@/lib/validations/games';
import { STEAM_PLATFORM } from '@/lib/games/consoles';

type Context = { params: Promise<{ id: string }> };

/**
 * The signed-in user and the game id, or an error response. Games added by
 * hand can be edited and deleted here; Steam games only once moved to a
 * console (their hours, and moving back), since the rest comes from the sync.
 */
async function authorize(request: NextRequest, { params }: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: jsonError('Unauthorized', 401) };

  const rateLimitResult = checkRateLimit(`game-status:${user.id}`, RATE_LIMITS.gameStatus);
  if (!rateLimitResult.success) return { response: rateLimited(rateLimitResult) };

  const id = gameIdSchema.safeParse(Number((await params).id));
  if (!id.success) return { response: jsonError('Invalid game id', 400) };
  return { supabase, userId: user.id, gameId: id.data };
}

/**
 * Saves the hours played, which consoles don't report, or moves a Steam game
 * you'd moved to a console back to Steam. Its Steam playtime returns with the
 * next sync, which no longer skips it.
 */
export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorize(request, context);
  if ('response' in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = updateManualGameSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);

  const query =
    'playOnSteam' in parsed.data
      ? auth.supabase
          .from('games')
          .update({ platform: STEAM_PLATFORM, igdb_id: null })
          .eq('source', 'steam')
      : auth.supabase
          .from('games')
          .update({ playtime_forever: Math.round(parsed.data.hoursPlayed * 60) })
          // A game added by hand, or a Steam game moved to a console.
          .or(`source.eq.manual,platform.neq.${STEAM_PLATFORM}`);
  const { data, error } = await query.eq('user_id', auth.userId).eq('id', auth.gameId).select('id');
  if (error) {
    console.error(error);
    return jsonError('Failed to save', 500);
  }
  if (!data?.length) return jsonError('Game not found', 404);
  return NextResponse.json({ success: true });
}

/** Removes a game added by hand. Its queue entry goes with it. */
export async function DELETE(request: NextRequest, context: Context) {
  const auth = await authorize(request, context);
  if ('response' in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from('games')
    .delete()
    .eq('user_id', auth.userId)
    .eq('id', auth.gameId)
    .eq('source', 'manual')
    .select('id');
  if (error) {
    console.error(error);
    return jsonError('Failed to delete', 500);
  }
  if (!data?.length) return jsonError('Game not found', 404);
  return NextResponse.json({ success: true });
}
