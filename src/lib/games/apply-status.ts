import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMOTED, statusUpdate, withLastPlayed, type StatusChange } from './status-rules';
import { PLAYING_GAME_SELECT } from '@/lib/data/loaders';
import type { GameWithImage } from '@/types/games';

export type { StatusChange };

export type StatusChangeResult = { ok: true } | { ok: false; status: 404 | 500; error: string };

/**
 * Sets a game's status for a user, server side: the status route and the
 * finish/drop route both use it so the rules live in one place. Only one game
 * can be playing, and the queue only holds backlog games.
 */
export async function applyStatusChange(
  supabase: SupabaseClient,
  userId: string,
  change: StatusChange,
): Promise<StatusChangeResult> {
  const { gameId, status } = change;
  const failed = (err: unknown): StatusChangeResult => {
    console.error(err);
    return { ok: false, status: 500, error: 'Failed to update game status' };
  };

  // Confirm the game is in the user's library before touching anything else,
  // so a bad gameId can't demote the current game and then update nothing.
  const { data: target, error: targetError } = await supabase
    .from('games')
    .select('id, status, source, platform')
    .eq('user_id', userId)
    .eq('id', gameId)
    .maybeSingle();
  if (targetError) return failed(targetError);
  if (!target) return { ok: false, status: 404, error: 'Game not found' };

  // Only one game can be playing: move any other one back to the backlog.
  if (status === 'playing') {
    const { data: others, error: playingError } = await supabase
      .from('games')
      .select('id, status, source, platform')
      .eq('user_id', userId)
      .eq('status', 'playing')
      .neq('id', gameId);
    if (playingError) return failed(playingError);
    for (const other of others ?? []) {
      const { error: demoteError } = await supabase
        .from('games')
        .update(withLastPlayed(other, DEMOTED))
        .eq('user_id', userId)
        .eq('id', other.id);
      if (demoteError) return failed(demoteError);
    }
  }

  const { error } = await supabase
    .from('games')
    .update(withLastPlayed(target, statusUpdate(change)))
    .eq('user_id', userId)
    .eq('id', gameId);
  if (error) return failed(error);

  // The queue only holds backlog games; any other status takes the game off it.
  if (status !== 'backlog') {
    const { error: dequeueError } = await supabase
      .from('playing_queue')
      .delete()
      .eq('user_id', userId)
      .eq('game_id', gameId);
    if (dequeueError) console.error(dequeueError);
  }

  return { ok: true };
}

/**
 * Starts the first game in the queue, if there is one, and returns it with
 * everything the playing card shows. Throws if the queue had a game but it
 * couldn't be started.
 */
export async function promoteNextFromQueue(
  supabase: SupabaseClient,
  userId: string,
): Promise<GameWithImage | null> {
  const { data: topItem, error: queueError } = await supabase
    .from('playing_queue')
    .select('game_id')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queueError) throw queueError;
  if (!topItem) return null;

  const started = await applyStatusChange(supabase, userId, {
    gameId: topItem.game_id,
    status: 'playing',
  });
  if (!started.ok) throw new Error(`Failed to start the next queued game: ${started.error}`);

  const { data: game, error } = await supabase
    .from('games')
    .select(PLAYING_GAME_SELECT)
    .eq('user_id', userId)
    .eq('id', topItem.game_id)
    .maybeSingle<GameWithImage>();
  if (error) throw error;
  return game ?? null;
}
