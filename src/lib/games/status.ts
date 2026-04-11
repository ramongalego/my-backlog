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
