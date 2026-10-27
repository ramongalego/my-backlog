import type { SupabaseClient } from '@supabase/supabase-js';
import { chunk, fetchAllRows } from '@/lib/supabase/paginate';
import {
  getCriticScoresByIgdbId,
  getCriticScoresBySteamId,
  type CriticScore,
} from '@/lib/igdb/api';

const UPDATE_CONCURRENCY = 25;

interface StoredGame extends CriticScore {
  id: number;
  source: string;
  app_id: number | null;
  igdb_id: number | null;
}

/**
 * Brings a user's critic scores up to date: IGDB's average of critics'
 * reviews, for Steam games (found by their Steam id) and games added by hand
 * (by their IGDB id) alike, so every game can be rated on the same scale.
 * Reviews keep coming in after a release, so it runs with the daily review
 * refresh; only scores that changed are written. A game IGDB no longer has a
 * score for keeps the one it had.
 */
export async function refreshCriticScores(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const games = await fetchAllRows<StoredGame>((from, to) =>
    supabase
      .from('games')
      .select('id, source, app_id, igdb_id, critic_score, critic_count')
      .eq('user_id', userId)
      .eq('type', 'game')
      .order('id')
      .range(from, to),
  );
  if (!games.length) return 0;

  const steamIds = games.flatMap((g) => (g.source === 'steam' && g.app_id ? [g.app_id] : []));
  const igdbIds = games.flatMap((g) => (g.source === 'manual' && g.igdb_id ? [g.igdb_id] : []));
  const [bySteam, byIgdb] = await Promise.all([
    getCriticScoresBySteamId(steamIds),
    getCriticScoresByIgdbId(igdbIds),
  ]);

  const updates = games.flatMap((game) => {
    const fresh =
      game.source === 'steam' ? bySteam.get(game.app_id!) : byIgdb.get(game.igdb_id ?? -1);
    if (
      !fresh ||
      (fresh.critic_score === game.critic_score && fresh.critic_count === game.critic_count)
    ) {
      return [];
    }
    return [{ id: game.id, ...fresh }];
  });

  for (const batch of chunk(updates, UPDATE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map(({ id, ...values }) =>
        supabase.from('games').update(values).eq('user_id', userId).eq('id', id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }

  return updates.length;
}
