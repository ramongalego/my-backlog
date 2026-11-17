import type { PickMode, PickOutcome } from '@/lib/suggest/types';

// Tells the server about picks, so they're kept for later study (game_picks):
// a random pick, which the browser makes itself, and what the player did with
// a pick. A pick works the same whether or not it was kept, so nothing here
// throws, and nothing waits on it to show the game.

/**
 * Keeps a random pick. Resolves with its id, or null when it couldn't be
 * kept. `outcome` is for Home's Random, which starts its game at once.
 */
export async function recordRandomPick(pick: {
  gameId: number;
  mode: PickMode;
  /** Which pick of the sitting: 1, then 2 after one roll again, and so on. */
  attempt: number;
  outcome?: 'played';
}): Promise<number | null> {
  try {
    const res = await fetch('/api/suggest/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pick),
      // The page may be left before it's answered.
      keepalive: true,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const pickId = (data as { pickId?: unknown } | null)?.pickId;
    return typeof pickId === 'number' ? pickId : null;
  } catch {
    return null;
  }
}

/**
 * Keeps what the player did with a pick (nothing, for a pick that wasn't
 * kept). The server takes the first answer for a pick and ignores any other.
 */
export function recordPickOutcome(pickId: number | null | undefined, outcome: PickOutcome): void {
  if (pickId == null) return;
  fetch('/api/suggest/picks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pickId, outcome }),
    keepalive: true,
  }).catch(() => {
    // Not needed for the pick to work.
  });
}
