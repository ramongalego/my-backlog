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
  await fetch('/api/games/status', {
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
}
