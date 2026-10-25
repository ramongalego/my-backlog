import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameStatusBody } from '@/lib/validations/games';
import { PLAYING_GAME_SELECT } from '@/lib/data/loaders';
import type { GameWithImage } from '@/types/games';

export type StatusChange = Omit<GameStatusBody, 'appId'> & { appId: number };

export type StatusChangeResult = { ok: true } | { ok: false; status: 404 | 500; error: string };

/**
 * Sets a game's status for a user, server side: the status route and the
 * finish/drop route both use it so the rules live in one place. Only one game
 * can be playing, and the queue only holds backlog games.
 */
export async function applyStatusChange(
  supabase: SupabaseClient,
  userId: string,
  { appId, status, finishedAt, droppedAt, notes, rating }: StatusChange,
): Promise<StatusChangeResult> {
  const failed = (err: unknown): StatusChangeResult => {
    console.error(err);
    return { ok: false, status: 500, error: 'Failed to update game status' };
  };

  // Confirm the game is in the user's library before touching anything else,
  // so a bad appId can't demote the current game and then update nothing.
  const { data: target, error: targetError } = await supabase
    .from('games')
    .select('app_id')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .maybeSingle();
  if (targetError) return failed(targetError);
  if (!target) return { ok: false, status: 404, error: 'Game not found' };

  // Only one game can be playing: move any other one back to the backlog.
  if (status === 'playing') {
    const { error: demoteError } = await supabase
      .from('games')
      .update({ status: 'backlog', started_at: null })
      .eq('user_id', userId)
      .eq('status', 'playing')
      .neq('app_id', appId);
    if (demoteError) return failed(demoteError);
  }

  type GameUpdate = {
    status: string;
    started_at?: string | null;
    finished_at?: string | null;
    dropped_at?: string | null;
    notes?: string | null;
    rating?: number | null;
  };
  const updatePayload: GameUpdate = { status };

  if (status === 'playing') {
    updatePayload.started_at = new Date().toISOString();
  } else if (status === 'backlog') {
    updatePayload.started_at = null;
  } else if (status === 'finished') {
    updatePayload.finished_at = finishedAt || null;
    updatePayload.notes = notes ?? null;
    updatePayload.rating = rating ?? null;
  } else if (status === 'dropped') {
    updatePayload.dropped_at = droppedAt || null;
    updatePayload.notes = notes ?? null;
    updatePayload.rating = rating ?? null;
  } else if (status === 'wont_play' || status === 'hidden') {
    updatePayload.started_at = null;
    updatePayload.finished_at = null;
    updatePayload.dropped_at = null;
    updatePayload.notes = null;
    updatePayload.rating = null;
  }

  const { error } = await supabase
    .from('games')
    .update(updatePayload)
    .eq('user_id', userId)
    .eq('app_id', appId);
  if (error) return failed(error);

  // The queue only holds backlog games; any other status takes the game off it.
  if (status !== 'backlog') {
    const { error: dequeueError } = await supabase
      .from('playing_queue')
      .delete()
      .eq('user_id', userId)
      .eq('app_id', appId);
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
    .select('app_id')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queueError) throw queueError;
  if (!topItem) return null;

  const started = await applyStatusChange(supabase, userId, {
    appId: topItem.app_id,
    status: 'playing',
  });
  if (!started.ok) throw new Error(`Failed to start the next queued game: ${started.error}`);

  const { data: game, error } = await supabase
    .from('games')
    .select(PLAYING_GAME_SELECT)
    .eq('user_id', userId)
    .eq('app_id', topItem.app_id)
    .maybeSingle<GameWithImage>();
  if (error) throw error;
  return game ?? null;
}
