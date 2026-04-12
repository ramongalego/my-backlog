import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMetadataFresh } from '@/lib/games/scoring';
import { fetchGameMetadata, type GameMetadata } from '@/lib/games/metadata-fetch';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting per user (not IP) so each user gets their own quota
  const rateLimitResult = checkRateLimit(`game-sync:${user.id}`, RATE_LIMITS.gameSync);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { appId, name: libraryName } = body;

  if (!appId || typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Invalid appId' }, { status: 400 });
  }

  // Check for existing fresh metadata in shared table
  const { data: existingMetadata } = await supabase
    .from('game_metadata')
    .select(
      'app_id, platform, type, name, genres, categories, description, release_date, header_image, steam_review_score, steam_review_count, steam_review_weighted, main_story_hours, deck_compat, tags, synced_at',
    )
    .eq('app_id', appId)
    .maybeSingle();

  let metadata: GameMetadata | null = null;
  let fromCache = false;

  const cacheIsUsable =
    existingMetadata &&
    isMetadataFresh(existingMetadata.synced_at) &&
    (existingMetadata.type !== 'game' || existingMetadata.main_story_hours !== null);

  if (cacheIsUsable) {
    metadata = existingMetadata as GameMetadata;
    fromCache = true;
  } else {
    metadata = await fetchGameMetadata(appId, libraryName);
    if (metadata) {
      await supabase.from('game_metadata').upsert(metadata, { onConflict: 'app_id' });
    }
  }

  if (metadata) {
    // Update user's game with metadata from shared table
    await supabase
      .from('games')
      .update({
        platform: metadata.platform,
        type: metadata.type,
        genres: metadata.genres,
        categories: metadata.categories,
        description: metadata.description,
        release_date: metadata.release_date,
        steam_review_score: metadata.steam_review_score,
        steam_review_count: metadata.steam_review_count,
        steam_review_weighted: metadata.steam_review_weighted,
        header_image: metadata.header_image,
        main_story_hours: metadata.main_story_hours,
        deck_compat: metadata.deck_compat,
        tags: metadata.tags,
        metadata_synced: true,
      })
      .eq('user_id', user.id)
      .eq('app_id', appId);

    return NextResponse.json({
      success: true,
      fromCache,
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
    await supabase
      .from('games')
      .update({ metadata_synced: true })
      .eq('user_id', user.id)
      .eq('app_id', appId);

    return NextResponse.json({ success: true, fromCache: false, metadata: null });
  }
}
