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
    const results = await searchGames(query.data);
    // Mark the games you already own on Steam: adding one moves that entry to
    // the console you pick instead of listing the game twice.
    const appIds = [...new Set(results.flatMap((r) => r.steamAppIds))];
    const { data: owned, error } = appIds.length
      ? await supabase
          .from('games')
          .select('id, app_id, status, platform, finished_at, dropped_at, notes, rating')
          .eq('user_id', user.id)
          .eq('source', 'steam')
          .in('app_id', appIds)
      : { data: [], error: null };
    if (error) throw error;
    return NextResponse.json(
      {
        results: results.map(({ steamAppIds, ...result }) => {
          const game = owned?.find((g) => steamAppIds.includes(g.app_id));
          return {
            ...result,
            steamGame: game
              ? {
                  id: game.id,
                  status: game.status,
                  platform: game.platform,
                  date: game.finished_at ?? game.dropped_at,
                  notes: game.notes,
                  rating: game.rating,
                }
              : null,
          };
        }),
      },
      // Not cached: it carries your library's current state (a game you just
      // moved), which the dialog starts from and saves back.
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error(err);
    return jsonError("Game search isn't working right now. Try again in a minute.", 503);
  }
}
