import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { isMetadataFresh } from '@/lib/games/scoring';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { syncBulkRequestSchema, MAX_BULK_APP_IDS } from '@/lib/validations/common';

const DB_BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(`game-sync-bulk:${user.id}`, RATE_LIMITS.gameSyncBulk);
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = syncBulkRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.code === 'too_big');
    return jsonError(
      tooMany ? `Maximum ${MAX_BULK_APP_IDS} app IDs per request` : 'Invalid appIds',
      400,
    );
  }
  const validAppIds = parsed.data.appIds;

  // Fetch all matching metadata from shared cache in one query
  const { data: cachedRows } = await supabase
    .from('game_metadata')
    .select(
      'app_id, platform, type, genres, categories, description, release_date, header_image, steam_review_score, steam_review_count, steam_review_weighted, main_story_hours, deck_compat, tags, synced_at',
    )
    .in('app_id', validAppIds);

  // Filter to only fresh, complete entries
  const freshRows =
    cachedRows?.filter(
      (row) =>
        isMetadataFresh(row.synced_at) && (row.type !== 'game' || row.main_story_hours !== null),
    ) ?? [];

  // Bulk update user's games table for all cache hits.
  // Writes run in concurrent batches; a failed write previously returned
  // { synced } as if it succeeded — capture errors so silent data loss
  // surfaces in Sentry and the client sees a 500.
  const userId = user.id;
  for (let i = 0; i < freshRows.length; i += DB_BATCH_SIZE) {
    const batch = freshRows.slice(i, i + DB_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((row) =>
        supabase
          .from('games')
          .update({
            platform: row.platform,
            type: row.type,
            genres: row.genres,
            categories: row.categories,
            description: row.description,
            release_date: row.release_date,
            header_image: row.header_image,
            steam_review_score: row.steam_review_score,
            steam_review_count: row.steam_review_count,
            steam_review_weighted: row.steam_review_weighted,
            main_story_hours: row.main_story_hours,
            deck_compat: row.deck_compat,
            tags: row.tags,
            metadata_synced: true,
          })
          .eq('user_id', userId)
          .eq('app_id', row.app_id),
      ),
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      Sentry.captureException(failed.error);
      return jsonError('Failed to sync game metadata', 500);
    }
  }

  // Return the app_ids that weren't resolved from cache
  const resolvedIds = new Set(freshRows.map((r) => r.app_id));
  const remaining = validAppIds.filter((id: number) => !resolvedIds.has(id));

  return NextResponse.json({
    synced: freshRows.length,
    remaining,
  });
}
