import type { SupabaseClient } from '@supabase/supabase-js';
import { RANDOM_PICK_MAX_PLAYTIME_MINUTES } from './filtering';
import type { SuggestionResult } from '@/lib/suggest/types';

/**
 * How long a random pick's roll lasts. The pick itself is all but instant;
 * the backlog flicks past this long, slowing down, so it reads as a roll.
 */
export const RANDOM_ROLL_MS = 2200;

/** A randomly picked game: what the playing band and the picker's result card show. */
export type RandomGame = SuggestionResult['game'] & {
  source: string;
  platform: string | null;
};

const RANDOM_GAME_SELECT =
  'id, app_id, source, platform, name, header_image, main_story_hours, genres, tags, steam_review_score, steam_review_count, critic_score, critic_count, playtime_forever, last_played_at';

/**
 * A random game to play from the backlog: single-player, with a known length
 * and barely started. Never the game you're playing (it isn't backlog) or a
 * queued one (already decided on, as Pick My Game leaves them out). Counts
 * the eligible games, then fetches only the one at a random position, instead
 * of downloading them all to choose one.
 */
export async function findRandomBacklogGame(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ game: RandomGame } | { error: 'none' | 'failed' }> {
  try {
    // From the server rather than the page, so a queue still loading or
    // changed in another tab can't let a queued game through.
    const queue = await supabase.from('playing_queue').select('game_id').eq('user_id', userId);
    if (queue.error) throw queue.error;
    const queued: number[] = (queue.data ?? []).map((q: { game_id: number }) => q.game_id);

    const eligible = (columns: string, options?: { count: 'exact'; head: true }) => {
      const query = supabase
        .from('games')
        .select(columns, options)
        .eq('user_id', userId)
        .eq('type', 'game')
        .not('main_story_hours', 'is', null)
        .lte('playtime_forever', RANDOM_PICK_MAX_PLAYTIME_MINUTES)
        .contains('categories', ['Single-player'])
        .or('status.is.null,status.eq.backlog');
      return queued.length ? query.not('id', 'in', `(${queued.join(',')})`) : query;
    };

    const counted = await eligible('id', { count: 'exact', head: true });
    if (counted.error) throw counted.error;
    if (!counted.count) return { error: 'none' };

    const index = Math.floor(Math.random() * counted.count);
    const { data, error } = await eligible(RANDOM_GAME_SELECT).order('id').range(index, index);
    if (error) throw error;
    const game = (data as unknown as RandomGame[] | null)?.[0];
    // The library changed between the two requests; asking again is enough.
    return game ? { game } : { error: 'failed' };
  } catch (err) {
    console.error('Failed to load a game for random pick:', err);
    return { error: 'failed' };
  }
}
