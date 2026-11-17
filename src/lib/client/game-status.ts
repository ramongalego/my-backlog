import type { GameWithImage } from '@/types/games';
import type { GameStatus } from '@/lib/games/status';
import type { CompletionCounts } from '@/lib/games/completion';
import type { StatusChange } from '@/lib/games/status-rules';
import type { GameRestore } from '@/lib/games/bulk-status';

export async function updateGameStatus(
  gameId: number,
  status: GameStatus,
  opts?: {
    finishedAt?: string;
    droppedAt?: string;
    notes?: string;
    rating?: number | null;
    /** Pause the game being played (top of the queue) instead of moving it to the backlog. */
    pausePlaying?: boolean;
    /** With status backlog: put the game at the top of the queue in the same save. */
    queueAtTop?: boolean;
    /**
     * This change is an Undo of the last one. Every Undo that changes a game
     * says so: the history then takes the change back out instead of
     * recording a second one, however long the toast waited to be pressed.
     */
    undo?: boolean;
    /**
     * With an Undo that starts the game again: when it had been started and
     * last played, so it comes back as it was and not as started just now.
     */
    startedAt?: string | null;
    lastPlayedAt?: string | null;
    /**
     * With an Undo: how long ago the change it undoes was made (`sinceNow`,
     * lib/undo.ts), so the history takes it out of that change and no other.
     */
    undoAgoMs?: number;
  },
): Promise<{
  paused: { id: number; name: string }[];
  /** When the game had been started, before this change. */
  startedAt?: string | null;
}> {
  const res = await fetch('/api/games/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameId,
      status,
      ...(opts?.finishedAt ? { finishedAt: opts.finishedAt } : {}),
      ...(opts?.droppedAt ? { droppedAt: opts.droppedAt } : {}),
      notes: opts?.notes,
      rating: opts?.rating,
      ...(opts?.pausePlaying ? { pausePlaying: true } : {}),
      ...(opts?.queueAtTop ? { queueAtTop: true } : {}),
      ...(opts?.undo ? { undo: true } : {}),
      ...(opts?.undo && opts.undoAgoMs !== undefined ? { undoAgoMs: opts.undoAgoMs } : {}),
      ...(opts?.undo && opts.startedAt !== undefined ? { startedAt: opts.startedAt } : {}),
      ...(opts?.undo && opts.lastPlayedAt !== undefined ? { lastPlayedAt: opts.lastPlayedAt } : {}),
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error ? `: ${body.error}` : '';
    } catch {
      // response body wasn't JSON — ignore
    }
    throw new Error(`updateGameStatus failed (${res.status})${detail}`);
  }
  const body = await res.json().catch(() => null);
  return { paused: body?.paused ?? [], startedAt: body?.startedAt ?? null };
}

/** A bulk move the server didn't make, with its status so the page can say why. */
export class BulkMoveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'BulkMoveError';
  }
}

async function postBulk(body: object): Promise<{ previous?: GameRestore[] }> {
  const res = await fetch('/api/games/status/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const answer = await res.json().catch(() => null);
  // Anything but the route's own "done" counts as not saved, a 200 with some
  // other body included (a proxy's page, say): the games would look moved.
  if (!res.ok || answer?.success !== true) {
    throw new BulkMoveError(answer?.error ?? '', res.status);
  }
  return answer;
}

/**
 * Moves several games to a status in one request (Games, Select), all or
 * none. Resolves with what each game had before, for Undo.
 */
export async function updateGameStatuses(changes: StatusChange[]): Promise<GameRestore[]> {
  return (await postBulk({ changes })).previous ?? [];
}

/**
 * Puts several games back exactly as they were: a bulk change's Undo.
 * `agoMs` is how long ago the change was made (`sinceNow`, lib/undo.ts).
 */
export async function restoreGameStatuses(games: GameRestore[], agoMs?: number): Promise<void> {
  await postBulk({ restore: games, ...(agoMs !== undefined ? { agoMs } : {}) });
}

interface CompleteGameResult {
  counts: CompletionCounts;
  promoted: GameWithImage | null;
  promoteFailed: boolean;
}

/**
 * Finishes or drops the playing game, gets the summary counts and starts the
 * next queued game, all in one request (see /api/games/complete).
 */
export async function completeGame(
  gameId: number,
  status: 'finished' | 'dropped',
  opts: { date?: string; notes?: string; rating?: number | null },
): Promise<CompleteGameResult> {
  const res = await fetch('/api/games/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gameId,
      status,
      ...(opts.date ? { [status === 'finished' ? 'finishedAt' : 'droppedAt']: opts.date } : {}),
      notes: opts.notes,
      rating: opts.rating,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`completeGame failed (${res.status})${body?.error ? `: ${body.error}` : ''}`);
  }
  return res.json();
}
