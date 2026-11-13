import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEMOTED,
  PAUSED,
  statusUpdate,
  withLastPlayed,
  type StatusChange,
} from '@/lib/games/status-rules';
import { PLAYING_GAME_SELECT } from '@/lib/data/loaders';
import { isReleased } from '@/lib/games/release-date';
import type { GameWithImage } from '@/types/games';

/** A game paused for another one (`pausePlaying`): reported so the browser
 * can say which, from what the server found playing, not its own guess. */
interface PausedGame {
  id: number;
  name: string;
}

/** What apply_status_change raises for a game that isn't in the user's library. */
const GAME_NOT_FOUND = 'P0002';

type StatusChangeResult =
  { ok: true; paused: PausedGame[] } | { ok: false; status: 404 | 500; error: string };

/**
 * Sets a game's status for a user, server side: the status route and the
 * finish/drop route both use it so the rules live in one place. Only one game
 * can be playing, and the queue only holds backlog games. With `pausePlaying`,
 * the game that was playing goes to the top of the queue instead, and keeps
 * its start date: a paused game picked up again from the queue resumes. With
 * `queueAtTop`, a game going back to the backlog (the one being played, moved
 * to the queue) is put at the top of the queue in the same save.
 */
export async function applyStatusChange(
  supabase: SupabaseClient,
  userId: string,
  change: StatusChange,
): Promise<StatusChangeResult> {
  const { gameId, status, pausePlaying = false, queueAtTop = false } = change;
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

  // Only one game can be playing: any other one goes back to the backlog, or
  // is paused at the top of the queue. Those come first in the list, since the
  // database allows one playing game at any moment.
  const updates: { id: number; update: ReturnType<typeof statusUpdate> }[] = [];
  const paused: PausedGame[] = [];
  if (status === 'playing') {
    const { data: others, error: playingError } = await supabase
      .from('games')
      .select('id, name, status, source, platform, started_at')
      .eq('user_id', userId)
      .eq('status', 'playing')
      .neq('id', gameId);
    if (playingError) return failed(playingError);
    for (const other of others ?? []) {
      updates.push({
        id: other.id,
        update: withLastPlayed(other, pausePlaying ? PAUSED : DEMOTED),
      });
      if (pausePlaying) paused.push({ id: other.id, name: other.name });
    }
  }

  const update = statusUpdate(change);
  if (resuming) delete update.started_at;
  updates.push({ id: gameId, update: withLastPlayed(target, update) });

  // The games that go to the top of the queue: one paused for another, or
  // this one, moved there from playing.
  const toTop = paused.map((game) => game.id);
  if (queueAtTop && status === 'backlog') toTop.push(gameId);

  // Saved in one transaction (apply_status_change): every game's new columns,
  // taking any that left the backlog off the queue, and those games' place at
  // the top of it. If any part fails, none of it is saved.
  const { error } = await supabase.rpc('apply_status_change', {
    p_updates: updates,
    p_pause_ids: toTop,
  });
  if (error) {
    // Removed between the check above and the save.
    if (error.code === GAME_NOT_FOUND) return { ok: false, status: 404, error: 'Game not found' };
    return failed(error);
  }

  return { ok: true, paused };
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
