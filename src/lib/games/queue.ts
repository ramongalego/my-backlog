// Throws on failure so query functions surface an error instead of caching an
// empty queue as if it were real data.
export async function fetchQueuedAppIds(): Promise<Set<number>> {
  const res = await fetch('/api/queue');
  if (!res.ok) throw new Error(`Failed to load queue (${res.status})`);
  const data = await res.json();
  return new Set<number>((data.queue ?? []).map((q: { app_id: number }) => q.app_id));
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
