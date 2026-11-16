import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { favoriteGamesSchema } from '@/lib/validations/profile';

/**
 * Saves the games a player picked as their favorites, in order (an empty list
 * clears them). The whole set is replaced in one transaction by the
 * set_favorite_games database function, so saving the same picks twice
 * changes nothing.
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = checkRateLimit(`profile-write:${user.id}`, RATE_LIMITS.profileWrite);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = favoriteGamesSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);

  const { error } = await supabase.rpc('set_favorite_games', { p_game_ids: parsed.data.gameIds });
  if (error) {
    // The function's own refusals: a game that isn't in the library (removed
    // in another tab since the picker opened).
    if (error.code === '22023') {
      return jsonError('One of those games is no longer in your library', 400);
    }
    // Two saves at once (another tab): the other one's rows were in the way.
    if (error.code === '23505') {
      return jsonError('Your favorites changed somewhere else. Try again.', 409);
    }
    console.error(error);
    return jsonError("Couldn't save your favorites. Please try again.", 500);
  }

  return NextResponse.json({ gameIds: parsed.data.gameIds });
}
