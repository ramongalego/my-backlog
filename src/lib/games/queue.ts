// Client helpers for writing to /api/queue (reads use loadQueue directly). All of them throw on failure so query
// functions and mutations surface errors instead of treating them as success.

async function assertOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  const detail = body?.error ? `: ${body.error}` : '';
  throw new Error(`${action} failed (${res.status})${detail}`);
}

export async function addToQueue(gameId: number): Promise<void> {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
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
