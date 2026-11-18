// These throw on failure, so mutations surface errors instead of treating them as success.

async function assertOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  const detail = body?.error ? `: ${body.error}` : '';
  throw new Error(`${action} failed (${res.status})${detail}`);
}

/** As an Undo of taking it off, `undoAgoMs` is how long ago that was (`sinceNow`, lib/undo.ts). */
export async function addToQueue(gameId: number, undoAgoMs?: number): Promise<void> {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, ...(undoAgoMs !== undefined ? { undoAgoMs } : {}) }),
  });
  await assertOk(res, 'Add to queue');
}

export async function removeFromQueue(gameId: number): Promise<void> {
  const res = await fetch(`/api/queue?gameId=${gameId}`, { method: 'DELETE' });
  await assertOk(res, 'Remove from queue');
}

export async function reorderQueue(gameIds: number[]): Promise<void> {
  const res = await fetch('/api/queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: gameIds }),
  });
  await assertOk(res, 'Reorder queue');
}
