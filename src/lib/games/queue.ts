export async function fetchQueuedAppIds(): Promise<Set<number>> {
  try {
    const res = await fetch('/api/queue');
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set<number>((data.queue ?? []).map((q: { app_id: number }) => q.app_id));
  } catch {
    return new Set();
  }
}

export async function addToQueue(appId: number): Promise<boolean> {
  try {
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
