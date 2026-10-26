import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { gameSearchSchema } from '@/lib/validations/games';
import { gameIdSchema } from '@/lib/validations/common';
import { getGameDetails, searchGames } from '@/lib/igdb/api';

/**
 * IGDB for the Add game dialog: `?q=` searches, `?id=` returns one game's
 * details (its wide art and platforms) once it's picked.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const rateLimitResult = checkRateLimit(`game-search:${user.id}`, RATE_LIMITS.gameSearch);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  const params = new URL(request.url).searchParams;
  const cache = { 'Cache-Control': 'private, max-age=300' };

  try {
    if (params.has('id')) {
      const id = gameIdSchema.safeParse(Number(params.get('id')));
      if (!id.success) return jsonError('Invalid game id', 400);
      const details = await getGameDetails(id.data);
      if (!details) return jsonError('Game not found', 404);
      return NextResponse.json({ game: details }, { headers: cache });
    }

    const query = gameSearchSchema.safeParse(params.get('q') ?? '');
    if (!query.success) return jsonError('Search for at least 2 characters', 400);
    return NextResponse.json({ results: await searchGames(query.data) }, { headers: cache });
  } catch (err) {
    console.error(err);
    return jsonError("Game search isn't working right now. Try again in a minute.", 503);
  }
}
