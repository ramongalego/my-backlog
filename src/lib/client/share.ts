/**
 * Creates the public share page for a game the signed-in player has finished,
 * and returns its path. The server builds the page from the game itself; only
 * its id is sent.
 */
export async function createSharePage(gameId: number): Promise<string> {
  const res = await fetch('/api/share/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) throw new Error(body?.error ?? 'Failed to share');
  return body.url as string;
}
