import type { GameWithImage } from '@/types/games';
import type { CompletionCounts } from './completion';

export async function updateGameStatus(
  appId: number,
  status: string,
  opts?: {
    finishedAt?: string;
    droppedAt?: string;
    notes?: string;
    rating?: number | null;
  },
): Promise<void> {
  const res = await fetch('/api/games/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId,
      status,
      ...(opts?.finishedAt ? { finishedAt: opts.finishedAt } : {}),
      ...(opts?.droppedAt ? { droppedAt: opts.droppedAt } : {}),
      notes: opts?.notes,
      rating: opts?.rating,
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
}

export interface CompleteGameResult {
  counts: CompletionCounts;
  promoted: GameWithImage | null;
  promoteFailed: boolean;
}

/**
 * Finishes or drops the playing game, gets the summary counts and starts the
 * next queued game, all in one request (see /api/games/complete).
 */
export async function completeGame(
  appId: number,
  status: 'finished' | 'dropped',
  opts: { date?: string; notes?: string; rating?: number | null },
): Promise<CompleteGameResult> {
  const res = await fetch('/api/games/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId,
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
