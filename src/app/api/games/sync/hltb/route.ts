import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { getMainStoryHours, hltbBlockedForMs, HLTBUnavailableError } from '@/lib/hltb/api';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { syncHltbRequestSchema } from '@/lib/validations/common';

/**
 * Looks up HowLongToBeat times for games whose other details are already
 * synced. The app calls this in the background after setup, a few games at a
 * time, because HLTB only allows short bursts: when it starts refusing, the
 * rest come back as `pending` with how long to wait.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(`game-sync-hltb:${user.id}`, RATE_LIMITS.gameSyncHltb);
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = syncHltbRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid appIds', 400);
  }
  const { appIds } = parsed.data;

  // Only the caller's own games. They're searched by Steam's name for the game
  // (from the shared cache), not the name in the library, which its owner can
  // change: the hours found go into the cache every user reads.
  const [{ data: games, error: gamesError }, { data: cached, error: cacheError }] =
    await Promise.all([
      supabase.from('games').select('app_id, name').eq('user_id', user.id).in('app_id', appIds),
      supabase
        .from('game_metadata')
        .select('app_id, name, main_story_hours, hltb_attempts')
        .in('app_id', appIds),
    ]);
  if (gamesError || cacheError) {
    console.error(gamesError ?? cacheError);
    return jsonError('Failed to read games', 500);
  }
  const cache = new Map((cached ?? []).map((row) => [row.app_id as number, row]));
  const service = tryCreateServiceClient();

  const results: { appId: number; hours: number | null }[] = [];
  let pending: number[] = [];

  for (const [i, game] of (games ?? []).entries()) {
    const row = cache.get(game.app_id);
    let hours: number | null = row?.main_story_hours ?? null;

    // Another user's sync may have found it in the meantime.
    if (hours === null) {
      try {
        hours = await getMainStoryHours(row?.name ?? game.name);
      } catch (err) {
        if (!(err instanceof HLTBUnavailableError)) {
          console.error(err);
          // Nothing done yet: a plain failure, and the app tries again next
          // visit. Otherwise report the games already done and hand back this
          // one and the rest as pending, so each retry gets further or stops.
          if (results.length === 0) return jsonError('Failed to look up times', 500);
        }
        pending = (games ?? []).slice(i).map((g) => g.app_id);
        break;
      }

      // A miss advances the shared backoff, so other users don't re-ask HLTB
      // for a game it doesn't have.
      if (row?.name && service) {
        const { error } = await service
          .from('game_metadata')
          .update(
            hours !== null
              ? { main_story_hours: hours, hltb_attempts: 0 }
              : { hltb_attempts: (row.hltb_attempts ?? 0) + 1 },
          )
          .eq('app_id', game.app_id);
        if (error) console.error(error);
      }
    }

    if (hours !== null) {
      const { error } = await supabase
        .from('games')
        .update({ main_story_hours: hours })
        .eq('user_id', user.id)
        .eq('app_id', game.app_id);
      if (error) console.error(error);
    }
    results.push({ appId: game.app_id, hours });
  }

  return NextResponse.json({
    results,
    pending,
    retryAfterMs: pending.length > 0 ? hltbBlockedForMs() : 0,
  });
}
