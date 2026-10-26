import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { gameSearchSchema } from '@/lib/validations/games';
import { searchGames } from '@/lib/igdb/api';

/** Searches IGDB for the Add game dialog. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const rateLimitResult = checkRateLimit(`game-search:${user.id}`, RATE_LIMITS.gameSearch);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  const parsed = gameSearchSchema.safeParse(new URL(request.url).searchParams.get('q') ?? '');
  if (!parsed.success) return jsonError('Search for at least 2 characters', 400);

  try {
    const results = await searchGames(parsed.data);
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (err) {
    console.error(err);
    return jsonError('Game search is unavailable right now', 503);
  }
}
