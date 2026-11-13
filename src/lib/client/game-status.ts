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
  },
): Promise<{ paused: { id: number; name: string }[] }> {
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
  return { paused: body?.paused ?? [] };
}

async function postBulk(body: object): Promise<{ previous?: GameRestore[] }> {
  const res = await fetch('/api/games/status/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const answer = await res.json().catch(() => null);
  if (!res.ok) throw new Error(answer?.error ?? 'Failed to update the games');
  return answer ?? {};
}

/**
 * Moves several games to a status in one request (Games, Select), all or
 * none. Resolves with what each game had before, for Undo.
 */
export async function updateGameStatuses(changes: StatusChange[]): Promise<GameRestore[]> {
  return (await postBulk({ changes })).previous ?? [];
}

/** Puts several games back exactly as they were: a bulk change's Undo. */
export async function restoreGameStatuses(games: GameRestore[]): Promise<void> {
  await postBulk({ restore: games });
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
