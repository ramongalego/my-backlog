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
  steam_review_score: number | null;
  steam_review_count: number | null;
}

interface StoredGame extends StoredReviews {
  id: number;
  source: string;
  app_id: number | null;
  steam_app_id: number | null;
}

export function reviewsChanged(stored: StoredReviews, fresh: SteamReviewData): boolean {
  if (stored.steam_review_score !== fresh.score || stored.steam_review_count == null) return true;
  const previous = Math.max(stored.steam_review_count, 1);
  return Math.abs(fresh.count - stored.steam_review_count) / previous >= COUNT_CHANGE_RATIO;
}

/**
 * Brings a user's Steam review scores up to date: their Steam games', and
 * those of games added by hand that Steam also sells (steam_app_id). Scores
 * are otherwise copied once, when a game's metadata first syncs or it's
 * added. The user's own rows are updated with their client; the shared
 * metadata cache only when a service client is available (it's writable by
 * the service role alone).
 */
export async function refreshReviewScores(
  supabase: SupabaseClient,
  userId: string,
  service: SupabaseClient | null,
): Promise<number> {
  const rows = await fetchAllRows<StoredGame>((from, to) =>
    supabase
      .from('games')
      .select('id, source, app_id, steam_app_id, steam_review_score, steam_review_count')
      .eq('user_id', userId)
      .eq('type', 'game')
      .or('source.eq.steam,steam_app_id.not.is.null')
      .order('id')
      .range(from, to),
  );
  const steamIdOf = (g: StoredGame) => (g.source === 'steam' ? g.app_id : g.steam_app_id);
  const games = rows.filter((g) => steamIdOf(g) != null);
  if (!games.length) return 0;

  const fresh = await getStoreReviews([...new Set(games.map((g) => steamIdOf(g)!))]);
  const updates = games.flatMap((game) => {
    const reviews = fresh.get(steamIdOf(game)!);
    if (!reviews || !reviewsChanged(game, reviews)) return [];
    return [
      {
        game,
        values: {
          steam_review_score: reviews.score,
          steam_review_count: reviews.count,
          steam_review_weighted: calculateBayesianScore(reviews.score, reviews.count),
        },
      },
    ];
  });

  for (const batch of chunk(updates, UPDATE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.flatMap(({ game, values }) => [
        supabase.from('games').update(values).eq('user_id', userId).eq('id', game.id),
        // The shared cache holds Steam games only.
        ...(service && game.source === 'steam'
          ? [service.from('game_metadata').update(values).eq('app_id', game.app_id)]
          : []),
      ]),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return updates.length;
}
