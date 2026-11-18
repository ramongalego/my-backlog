import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { fetchGameMetadata, type FetchedMetadata } from '@/lib/server/metadata-fetch';
import {
  METADATA_COLUMNS,
  isCacheUsable,
  mergeForCache,
  toGameRowUpdate,
  type CachedMetadata,
  type GameMetadata,
} from '@/lib/games/metadata-cache';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
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

  // Per user, and counted across servers: each call can reach Steam and
  // HowLongToBeat with the app's allowance, which every player shares.
  const rateLimitResult = await checkSharedRateLimit(`game-sync:${user.id}`, RATE_LIMITS.gameSync);
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
    .select('id, header_image, art_chosen')
    .eq('user_id', user.id)
    .eq('app_id', appId)
    .limit(1)
    .maybeSingle<{ id: number; header_image: string | null; art_chosen: boolean }>();
  if (ownedError) {
    console.error(ownedError);
    return jsonError('Failed to read the game', 500);
  }
  if (!owned) return jsonError('Game not found', 404);

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
      if (!(err instanceof SteamUnavailableError)) {
        // Left unsynced, so the next visit tries it again.
        console.error(err);
        return jsonError('Failed to fetch game details', 500);
      }
      // Steam is throttling: left unsynced so the client retries it, rather
      // than recorded as a game with no store page.
      console.error(err.message);
      return jsonError('Steam is busy, try again shortly', 503, {
        'Retry-After': STEAM_RETRY_AFTER_SECONDS.toString(),
      });
    }
    if (fresh) {
      metadata = mergeForCache(fresh, existing);
      hltbPending = fresh.hltbUnavailable && metadata.main_story_hours === null;
      // Only the secret key writes the shared cache, so players can't plant
      // metadata in it; this data is from the app's own fetch, never the request.
      const service = tryCreateServiceClient();
      const { error: cacheError } = service
        ? await service.from('game_metadata').upsert(metadata, { onConflict: 'app_id' })
        : { error: new Error('SUPABASE_SECRET_KEY not configured; skipping metadata cache write') };
      if (cacheError) {
        // Non-fatal: the player's own row is still updated below. Logged to
        // catch systemic cache failures.
        console.error(cacheError);
      }
    }
  }

  if (metadata) {
    const { error: updateError } = await supabase
      .from('games')
      .update(toGameRowUpdate(metadata, owned.art_chosen))
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
        // What the game shows: art the player chose stays as it is.
        header_image: owned.art_chosen ? owned.header_image : metadata.header_image,
        main_story_hours: metadata.main_story_hours,
        steam_review_score: metadata.steam_review_score,
        steam_review_count: metadata.steam_review_count,
        steam_review_weighted: metadata.steam_review_weighted,
      },
    });
  } else {
    // Synced even with no data: the game may be gone from the store.
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
