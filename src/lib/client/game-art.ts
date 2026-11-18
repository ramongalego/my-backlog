// These throw with the server's message, which the Choose art picker shows as is.

interface ArtChoice {
  url: string;
  thumb: string;
}

export interface GameArtChoices {
  /** The art the game has without a choice. */
  original: string | null;
  /** The art it shows now: the original, or one chosen before. */
  current: string | null;
  /** SteamGridDB's images for the game, the original left out. */
  choices: ArtChoice[];
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? 'Something went wrong. Please try again.');
}

/** A game being added has only its IGDB id, and nowhere to save a pick until it's added. */
export type ArtGame = { gameId: number } | { igdbId: number };

export async function fetchArtChoices(game: ArtGame): Promise<GameArtChoices> {
  const query = 'gameId' in game ? `gameId=${game.gameId}` : `igdbId=${game.igdbId}`;
  const res = await check(await fetch(`/api/games/art?${query}`));
  return res.json();
}

/** Saves the art picked for a game (null for the original) and returns what it now shows. */
export async function saveGameArt(gameId: number, url: string | null): Promise<string | null> {
  const res = await check(
    await fetch('/api/games/art', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, url }),
    }),
  );
  return (await res.json()).header_image ?? null;
}
