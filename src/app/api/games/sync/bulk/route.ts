import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMetadataFresh } from '@/lib/games/scoring';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const MAX_APP_IDS = 2000;
const DB_BATCH_SIZE = 50;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`game-sync-bulk:${user.id}`, RATE_LIMITS.gameSyncBulk);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
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

  const { appIds } = body;

  if (!Array.isArray(appIds) || appIds.length === 0) {
    return NextResponse.json({ error: 'appIds must be a non-empty array' }, { status: 400 });
  }

  if (appIds.length > MAX_APP_IDS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_APP_IDS} app IDs per request` },
      { status: 400 },
    );
  }

  const validAppIds = appIds.filter(
    (id: unknown) => typeof id === 'number' && Number.isInteger(id) && id > 0,
  );

  if (validAppIds.length === 0) {
    return NextResponse.json({ error: 'No valid app IDs provided' }, { status: 400 });
  }

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

  // Bulk update user's games table for all cache hits
  const userId = user.id;
  for (let i = 0; i < freshRows.length; i += DB_BATCH_SIZE) {
    const batch = freshRows.slice(i, i + DB_BATCH_SIZE);
    await Promise.all(
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
  }

  // Return the app_ids that weren't resolved from cache
  const resolvedIds = new Set(freshRows.map((r) => r.app_id));
  const remaining = validAppIds.filter((id: number) => !resolvedIds.has(id));

  return NextResponse.json({
    synced: freshRows.length,
    remaining,
  });
}
