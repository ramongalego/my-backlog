import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOwnedGames } from '@/lib/steam/api';
import { syncOwnedGames } from '@/lib/steam/library';
import { refreshReviewScores } from '@/lib/steam/reviews';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { getSteamApiKey } from '@/lib/env.server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  // Rate limiting per user (not IP) — this is an authenticated endpoint
  const rateLimitResult = await checkSharedRateLimit(
    `steam-refresh:${user.id}`,
    RATE_LIMITS.steamRefresh,
  );
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  // Get user's Steam ID from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .single();

  if (!profile?.steam_id) {
    return jsonError('Steam not connected', 400);
  }

  let apiKey: string;
  try {
    apiKey = getSteamApiKey();
  } catch {
    return jsonError('Server config error', 500);
  }

  let steamGames;
  try {
    steamGames = await getOwnedGames(profile.steam_id, apiKey);
  } catch (error) {
    console.error('Steam API error:', error);
    return jsonError('Steam API failed', 502);
  }

  let result;
  try {
    result = await syncOwnedGames(supabase, user.id, steamGames);
  } catch (error) {
    console.error('Library refresh failed:', error);
    return jsonError('Failed to update library', 500);
  }

  // Review scores drift over time; keep them current. A failure here shouldn't
  // fail the refresh, since the library itself is already up to date.
  let updatedReviews = 0;
  try {
    updatedReviews = await refreshReviewScores(supabase, user.id, tryCreateServiceClient());
  } catch (error) {
    console.error('Review score refresh failed:', error);
  }

  return NextResponse.json({ success: true, ...result, updatedReviews });
}
