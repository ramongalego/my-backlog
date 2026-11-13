import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateBayesianScore } from '@/lib/games/scoring';
import { originalArt, syncedArt } from '@/lib/games/art';
import { chunk, fetchAllRows } from '@/lib/supabase/paginate';
import { getStoreSummaries, type SteamReviewData } from '@/lib/steam/store-api';

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
  header_image: string | null;
  art_chosen: boolean;
  default_header_image: string | null;
}

export function reviewsChanged(stored: StoredReviews, fresh: SteamReviewData): boolean {
  if (stored.steam_review_score !== fresh.score || stored.steam_review_count == null) return true;
  const previous = Math.max(stored.steam_review_count, 1);
  return Math.abs(fresh.count - stored.steam_review_count) / previous >= COUNT_CHANGE_RATIO;
}

// A store asset path with a content hash in it ("…/1827516e…/header_2x.jpg").
const HASHED_PATH = /\/[0-9a-f]{40}\//;

/**
 * Whether Steam's current header is a different picture from the one stored.
 * Steam bumps the `?t=` on every asset URL whenever any of an app's store
 * assets change, so for a hashed path only the path counts: the same path is
 * the same file. Older art lives at a fixed path (`…/header.jpg`) and is
 * replaced in place, so there `?t=` is the only sign it changed.
 */
export function headerImageChanged(stored: string | null, current: string): boolean {
  if (!stored) return true;
  const [storedPath] = stored.split('?');
  const [currentPath] = current.split('?');
  if (storedPath !== currentPath) return true;
  return !HASHED_PATH.test(currentPath) && stored !== current;
}

/**
 * Brings what a user's games show from the Steam store up to date: review
 * scores, and header art, which Steam swaps for launches, sales and events
 * (a "Preview available now" banner that's gone on release day). Their Steam
 * games, and games added by hand that Steam also sells (steam_app_id). Both
 * are otherwise copied once, when a game's metadata syncs or it's added, and
 * come from the same Steam calls here. The user's own rows are updated with
 * their client; the shared metadata cache only when a service client is
 * available (it's writable by the service role alone). Returns how many games
 * changed.
 */
export async function refreshStoreData(
  supabase: SupabaseClient,
  userId: string,
  service: SupabaseClient | null,
): Promise<number> {
  const rows = await fetchAllRows<StoredGame>((from, to) =>
    supabase
      .from('games')
      .select(
        'id, source, app_id, steam_app_id, steam_review_score, steam_review_count, header_image, art_chosen, default_header_image',
      )
      .eq('user_id', userId)
      .eq('type', 'game')
      .or('source.eq.steam,steam_app_id.not.is.null')
      .order('id')
      .range(from, to),
  );
  const steamIdOf = (g: StoredGame) => (g.source === 'steam' ? g.app_id : g.steam_app_id);
  const games = rows.filter((g) => steamIdOf(g) != null);
  if (!games.length) return 0;

  const fresh = await getStoreSummaries(
    [...new Set(games.map((g) => steamIdOf(g)!))],
    // Steam's art for the game, which a player's own choice sits in front of.
    new Map(games.map((g) => [steamIdOf(g)!, originalArt(g)])),
  );
  const updates = games.flatMap((game) => {
    const store = fresh.get(steamIdOf(game)!);
    if (!store) return [];
    const { reviews, headerImage } = store;
    const newReviews =
      reviews && reviewsChanged(game, reviews)
        ? {
            steam_review_score: reviews.score,
            steam_review_count: reviews.count,
            steam_review_weighted: calculateBayesianScore(reviews.score, reviews.count),
          }
        : {};
    // Only ever replaced with art Steam has: a game it no longer returns
    // art for keeps what it has.
    const newArt = headerImage && headerImageChanged(originalArt(game), headerImage);
    // The player's row: new art goes behind art they chose, not over it.
    const values = { ...newReviews, ...(newArt ? syncedArt(game, headerImage) : {}) };
    // The shared cache has no choices: it always takes Steam's art.
    const cached = { ...newReviews, ...(newArt ? { header_image: headerImage } : {}) };
    return Object.keys(values).length ? [{ game, values, cached }] : [];
  });

  for (const batch of chunk(updates, UPDATE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.flatMap(({ game, values, cached }) => [
        supabase.from('games').update(values).eq('user_id', userId).eq('id', game.id),
        // The shared cache holds Steam games only.
        ...(service && game.source === 'steam'
          ? [service.from('game_metadata').update(cached).eq('app_id', game.app_id)]
          : []),
      ]),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return updates.length;
}
