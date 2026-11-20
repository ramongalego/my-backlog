import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanStartOf, happened, type ActivityEvent } from '@/lib/account/activity';

/** A game's latest events: far more than lie between a start and its finish. */
const GAME_HISTORY = 200;

/**
 * When the game just finished was started, for the summary's "over 12 days",
 * where that can be told for certain (cleanStartOf, as Recent activity says
 * it); null otherwise, and when the history can't be read. Never fails the
 * finish: the summary just says less.
 */
export async function cleanRunStartedAt(
  supabase: SupabaseClient,
  userId: string,
  gameId: number,
): Promise<string | null> {
  const [game, history] = await Promise.all([
    supabase
      .from('games')
      .select('source, playtime_forever, last_played_at')
      .eq('user_id', userId)
      .eq('id', gameId)
      .maybeSingle(),
    supabase
      .from('game_events')
      .select('id, game_id, kind, changes, created_at, updated_at')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .order('id', { ascending: false })
      .limit(GAME_HISTORY),
  ]);
  if (game.error || history.error || !game.data) return null;
  const events = (history.data ?? []) as ActivityEvent[];
  // The finish just saved: the latest event that made it finished.
  const finish = events.find((event) => event.changes.status?.[1] === 'finished');
  if (!finish) return null;
  const start = cleanStartOf(finish, events, game.data);
  return start ? happened(start) : null;
}
