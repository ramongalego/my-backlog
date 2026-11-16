// Client helper for the profile's favorite games (/api/profile/favorites).

import { apiRequest, json } from './request';

/**
 * Saves the picked games, in order; an empty list clears them. Throws with a
 * message for the player (the server's, or what went wrong on the way), which
 * the page shows in a toast as it puts the row back.
 */
export async function saveFavoriteGames(gameIds: number[]): Promise<void> {
  const result = await apiRequest('/api/profile/favorites', json('PUT', { gameIds }), {
    failed: "Couldn't save your favorites. Please try again.",
    tooMany: 'Too many changes in a row. Try again in a minute.',
  });
  if (!result.ok) throw new Error(result.error);
}
