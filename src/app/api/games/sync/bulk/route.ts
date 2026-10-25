import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  METADATA_COLUMNS,
  isCacheUsable,
  toGameRowUpdate,
  type CachedMetadata,
} from '@/lib/games/metadata-cache';
import { chunk } from '@/lib/supabase/paginate';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { syncBulkRequestSchema, MAX_BULK_APP_IDS } from '@/lib/validations/common';

// Keeps each `.in()` URL short and each response under PostgREST's row cap.
const LOOKUP_CHUNK_SIZE = 200;
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

  const lookups = await Promise.all(
    chunk(validAppIds, LOOKUP_CHUNK_SIZE).map((ids) =>
      supabase.from('game_metadata').select(METADATA_COLUMNS).in('app_id', ids),
    ),
  );
  const lookupError = lookups.find((r) => r.error)?.error;
  if (lookupError) {
    console.error(lookupError);
    return jsonError('Failed to read metadata cache', 500);
  }

  const now = Date.now();
  const usableRows = lookups
    .flatMap((r) => (r.data ?? []) as CachedMetadata[])
    .filter((row) => isCacheUsable(row, now));

  // Copy cache hits onto the user's rows. Each row needs its own values, so
  // these are individual UPDATEs, run in concurrent batches.
  const userId = user.id;
  for (const batch of chunk(usableRows, DB_BATCH_SIZE)) {
    const results = await Promise.all(
      batch.map((row) =>
        supabase
          .from('games')
          .update(toGameRowUpdate(row))
          .eq('user_id', userId)
          .eq('app_id', row.app_id),
      ),
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error(failed.error);
      return jsonError('Failed to sync game metadata', 500);
    }
  }

  // Return the app_ids that weren't resolved from cache
  const resolvedIds = new Set(usableRows.map((r) => r.app_id));
  const remaining = validAppIds.filter((id) => !resolvedIds.has(id));

  return NextResponse.json({
    synced: usableRows.length,
    remaining,
  });
}
