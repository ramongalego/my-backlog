import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { isMetadataFresh } from '@/lib/games/scoring';
import { fetchGameMetadata, type GameMetadata } from '@/lib/games/metadata-fetch';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { syncSingleRequestSchema } from '@/lib/validations/common';

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
      const { error: cacheError } = await supabase
        .from('game_metadata')
        .upsert(metadata, { onConflict: 'app_id' });
      if (cacheError) {
        // Non-fatal: the shared cache write failed but we can still update the
        // user's own row below. Surface it so we notice systemic cache failures.
        Sentry.captureException(cacheError);
      }
    }
  }

  if (metadata) {
    // Update user's game with metadata from shared table
    const { error: updateError } = await supabase
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

    if (updateError) {
      Sentry.captureException(updateError);
      return jsonError('Failed to save game metadata', 500);
    }

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
    const { error: markError } = await supabase
      .from('games')
      .update({ metadata_synced: true })
      .eq('user_id', user.id)
      .eq('app_id', appId);

    if (markError) {
      Sentry.captureException(markError);
      return jsonError('Failed to update game', 500);
    }

    return NextResponse.json({ success: true, fromCache: false, metadata: null });
  }
}
