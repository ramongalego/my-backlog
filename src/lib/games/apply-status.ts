import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMOTED, PAUSED, statusUpdate, withLastPlayed, type StatusChange } from './status-rules';
import { PLAYING_GAME_SELECT } from '@/lib/data/loaders';
import { isReleased } from './release-date';
import type { GameWithImage } from '@/types/games';

export type { StatusChange };

export type StatusChangeResult = { ok: true } | { ok: false; status: 404 | 500; error: string };

/**
 * Sets a game's status for a user, server side: the status route and the
 * finish/drop route both use it so the rules live in one place. Only one game
 * can be playing, and the queue only holds backlog games. With `pausePlaying`,
 * the game that was playing goes to the top of the queue instead, and keeps
 * its start date: a paused game picked up again from the queue resumes.
 */
export async function applyStatusChange(
  supabase: SupabaseClient,
  userId: string,
  change: StatusChange,
): Promise<StatusChangeResult> {
  const { gameId, status, pausePlaying = false } = change;
  const failed = (err: unknown): StatusChangeResult => {
    console.error(err);
    return { ok: false, status: 500, error: 'Failed to update game status' };
  };

  // Confirm the game is in the user's library before touching anything else,
  // so a bad gameId can't demote the current game and then update nothing.
  const { data: target, error: targetError } = await supabase
    .from('games')
    .select('id, status, source, platform, started_at')
    .eq('user_id', userId)
    .eq('id', gameId)
    .maybeSingle();
  if (targetError) return failed(targetError);
  if (!target) return { ok: false, status: 404, error: 'Game not found' };

  // A game paused for another one keeps its start date while it waits in the
  // queue, and picking it up again carries on from there. (Taking it off the
  // queue for the backlog ends that: started again later, it starts afresh.)
  let resuming = false;
  if (status === 'playing' && target.status === 'backlog' && target.started_at) {
    const { data: queued, error: queuedError } = await supabase
      .from('playing_queue')
      .select('game_id')
      .eq('user_id', userId)
      .eq('game_id', gameId)
      .maybeSingle();
    if (queuedError) return failed(queuedError);
    resuming = !!queued;
  }

  // Only one game can be playing: move any other one back to the backlog, or
  // pause it at the top of the queue.
  const paused: number[] = [];
  if (status === 'playing') {
    const { data: others, error: playingError } = await supabase
      .from('games')
      .select('id, status, source, platform, started_at')
      .eq('user_id', userId)
      .eq('status', 'playing')
      .neq('id', gameId);
    if (playingError) return failed(playingError);
    for (const other of others ?? []) {
      const { error: demoteError } = await supabase
        .from('games')
        .update(withLastPlayed(other, pausePlaying ? PAUSED : DEMOTED))
        .eq('user_id', userId)
        .eq('id', other.id);
      if (demoteError) return failed(demoteError);
      if (pausePlaying) paused.push(other.id);
    }
  }

  const update = statusUpdate(change);
  if (resuming) delete update.started_at;
  const { error } = await supabase
    .from('games')
    .update(withLastPlayed(target, update))
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

  // The paused game goes first in the queue, ahead of what's there now.
  if (paused.length) {
    const { data: first, error: firstError } = await supabase
      .from('playing_queue')
      .select('position')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstError) return failed(firstError);
    const top = (first?.position ?? 1) - 1;
    const { error: queueError } = await supabase
      .from('playing_queue')
      .insert(paused.map((id, i) => ({ user_id: userId, game_id: id, position: top - i })));
    if (queueError) return failed(queueError);
  }

  return { ok: true };
}

/**
 * Starts the first game in the queue that's out, if there is one, and returns
 * it with everything the playing card shows. Games not out yet stay queued, in
 * their places. Throws if the queue had a game but it couldn't be started.
 */
export async function promoteNextFromQueue(
  supabase: SupabaseClient,
  userId: string,
): Promise<GameWithImage | null> {
  const { data: queue, error: queueError } = await supabase
    .from('playing_queue')
    .select('game_id')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (queueError) throw queueError;
  const ids = ((queue ?? []) as { game_id: number }[]).map((q) => q.game_id);
  if (ids.length === 0) return null;

  const { data: dates, error: datesError } = await supabase
    .from('games')
    .select('id, release_date')
    .eq('user_id', userId)
    .in('id', ids);
  if (datesError) throw datesError;
  const upcoming = new Set(
    ((dates ?? []) as { id: number; release_date: string | null }[])
      .filter((g) => !isReleased(g.release_date))
      .map((g) => g.id),
  );
  const nextId = ids.find((id) => !upcoming.has(id));
  if (nextId === undefined) return null;

  const started = await applyStatusChange(supabase, userId, {
    gameId: nextId,
    status: 'playing',
  });
  if (!started.ok) throw new Error(`Failed to start the next queued game: ${started.error}`);

  const { data: game, error } = await supabase
    .from('games')
    .select(PLAYING_GAME_SELECT)
    .eq('user_id', userId)
    .eq('id', nextId)
    .maybeSingle<GameWithImage>();
  if (error) throw error;
  return game ?? null;
}
