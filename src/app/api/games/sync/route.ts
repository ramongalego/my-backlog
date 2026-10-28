import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import {
  fetchGameMetadata,
  type FetchedMetadata,
  type GameMetadata,
} from '@/lib/games/metadata-fetch';
import {
  METADATA_COLUMNS,
  isCacheUsable,
  mergeForCache,
  toGameRowUpdate,
  type CachedMetadata,
} from '@/lib/games/metadata-cache';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { syncSingleRequestSchema } from '@/lib/validations/common';
import { SteamUnavailableError } from '@/lib/steam/store-api';

const STEAM_RETRY_AFTER_SECONDS = 10;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  // Rate limiting per user (not IP) so each user gets their own quota
  const rateLimitResult = checkRateLimit(`game-sync:${user.id}`, RATE_LIMITS.gameSync);
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = syncSingleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid appId', 400);
  }
  const { appId, name: libraryName } = parsed.data;

  // Only games in the caller's library: syncing looks the game up on Steam and
  // HowLongToBeat with the app's keys, and fills the cache every user reads.
  const { data: owned, error: ownedError } = await supabase
    .from('games')
    .select('id')
    .eq('user_id', user.id)
    .eq('app_id', appId)
    .limit(1)
    .maybeSingle();
  if (ownedError) {
    console.error(ownedError);
    return jsonError('Failed to read the game', 500);
  }
  if (!owned) return jsonError('Game not found', 404);

  // Check for existing fresh metadata in shared table
  const { data: existing } = await supabase
    .from('game_metadata')
    .select(METADATA_COLUMNS)
    .eq('app_id', appId)
    .maybeSingle<CachedMetadata>();

  let metadata: GameMetadata | null = null;
  let fromCache = false;
  // HLTB was rate limiting, so the time is looked up later in the background.
  let hltbPending = false;

  if (isCacheUsable(existing)) {
    metadata = existing;
    fromCache = true;
  } else {
    let fresh: FetchedMetadata | null;
    try {
      fresh = await fetchGameMetadata(appId, libraryName);
    } catch (err) {
      if (!(err instanceof SteamUnavailableError)) throw err;
      // Steam is throttling us. Leave the game unsynced so the client retries
      // it, instead of recording it as a game with no store page.
      console.error(err.message);
      return jsonError('Steam is busy, try again shortly', 503, {
        'Retry-After': STEAM_RETRY_AFTER_SECONDS.toString(),
      });
    }
    if (fresh) {
      metadata = mergeForCache(fresh, existing);
      hltbPending = fresh.hltbUnavailable && metadata.main_story_hours === null;
      // The shared cache is only writable with the secret key, so users can't
      // write arbitrary metadata into it. The data here comes from our own
      // upstream fetch, never from the request.
      const service = tryCreateServiceClient();
      const { error: cacheError } = service
        ? await service.from('game_metadata').upsert(metadata, { onConflict: 'app_id' })
        : { error: new Error('SUPABASE_SECRET_KEY not configured; skipping metadata cache write') };
      if (cacheError) {
        // Non-fatal: the shared cache write failed but we can still update the
        // user's own row below. Surface it so we notice systemic cache failures.
        console.error(cacheError);
      }
    }
  }

  if (metadata) {
    // Update user's game with metadata from shared table
    const { error: updateError } = await supabase
      .from('games')
      .update(toGameRowUpdate(metadata))
      .eq('user_id', user.id)
      .eq('app_id', appId);

    if (updateError) {
      console.error(updateError);
      return jsonError('Failed to save game metadata', 500);
    }

    return NextResponse.json({
      success: true,
      fromCache,
      hltbPending,
      metadata: {
        type: metadata.type,
        genres: metadata.genres,
        categories: metadata.categories,
        description: metadata.description,
        release_date: metadata.release_date,
        header_image: metadata.header_image,
        main_story_hours: metadata.main_story_hours,
        steam_review_score: metadata.steam_review_score,
        steam_review_count: metadata.steam_review_count,
        steam_review_weighted: metadata.steam_review_weighted,
      },
    });
  } else {
    // Mark as synced even if no data (game might be removed from store)
    const { error: markError } = await supabase
      .from('games')
      .update({ metadata_synced: true })
      .eq('user_id', user.id)
      .eq('app_id', appId);

    if (markError) {
      console.error(markError);
      return jsonError('Failed to update game', 500);
    }

    return NextResponse.json({ success: true, fromCache: false, metadata: null });
  }
}
