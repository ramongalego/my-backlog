import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateBayesianScore } from '@/lib/games/scoring';
import { chunk, fetchAllRows } from '@/lib/supabase/paginate';
import { getStoreReviews, type SteamReviewData } from './store-api';

const UPDATE_CONCURRENCY = 25;

// Popular games gain reviews every day; rewriting every row on each refresh
// would be wasted work. Only a change in the percentage, or enough new reviews
// to move the weighted score, is worth saving.
const COUNT_CHANGE_RATIO = 0.1;

interface StoredReviews {
  app_id: number;
  steam_review_score: number | null;
  steam_review_count: number | null;
}

export function reviewsChanged(stored: StoredReviews, fresh: SteamReviewData): boolean {
  if (stored.steam_review_score !== fresh.score || stored.steam_review_count == null) return true;
  const previous = Math.max(stored.steam_review_count, 1);
  return Math.abs(fresh.count - stored.steam_review_count) / previous >= COUNT_CHANGE_RATIO;
}

/**
 * Brings a user's Steam review scores up to date. Scores are otherwise copied
 * once, when a game's metadata first syncs. The user's own rows are updated
 * with their client; the shared metadata cache only when a service client is
 * available (it's writable by the service role alone).
 */
export async function refreshReviewScores(
  supabase: SupabaseClient,
  userId: string,
  service: SupabaseClient | null,
): Promise<number> {
  const games = await fetchAllRows<StoredReviews>((from, to) =>
    supabase
      .from('games')
      .select('app_id, steam_review_score, steam_review_count')
      .eq('user_id', userId)
      .eq('type', 'game')
      .order('app_id')
      .range(from, to),
  );
  if (!games.length) return 0;

  const fresh = await getStoreReviews(games.map((g) => g.app_id));
  const updates = games.flatMap((game) => {
    const reviews = fresh.get(game.app_id);
    if (!reviews || !reviewsChanged(game, reviews)) return [];
    return [
      {
        app_id: game.app_id,
        steam_review_score: reviews.score,
        steam_review_count: reviews.count,
        steam_review_weighted: calculateBayesianScore(reviews.score, reviews.count),
      },
    ];
  });

  for (const batch of chunk(updates, UPDATE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.flatMap(({ app_id, ...values }) => [
        supabase.from('games').update(values).eq('user_id', userId).eq('app_id', app_id),
        ...(service ? [service.from('game_metadata').update(values).eq('app_id', app_id)] : []),
      ]),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return updates.length;
}
