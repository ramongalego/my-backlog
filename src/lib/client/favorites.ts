// Client helper for the profile's favorite games (/api/profile/favorites). It
// throws with the server's message, which the picker shows as is.

/** Saves the picked games, in order; an empty list goes back to the highest rated. */
export async function saveFavoriteGames(gameIds: number[]): Promise<void> {
  const res = await fetch('/api/profile/favorites', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameIds }),
  });
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? 'Something went wrong. Please try again.');
}
