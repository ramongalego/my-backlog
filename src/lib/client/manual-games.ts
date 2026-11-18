import type { AddStatus, GameStatus } from '@/lib/games/status';
// These throw with the server's message, which the dialogs show as is.

interface GameDetails {
  name: string;
  platforms: string[];
  release_date: string | null;
  header_image: string | null;
  description: string | null;
}

export interface GameSearchResult {
  igdbId: number;
  name: string;
  year: number | null;
  cover: string | null;
  platforms: string[];
  /** Adding a game already in the library moves that entry, so a game is only ever listed once. */
  libraryGame: {
    id: number;
    fromSteam: boolean;
    status: GameStatus;
    platform: string | null;
    /** When it was finished or dropped, and your notes and rating, to start the dialog from. */
    date: string | null;
    notes: string | null;
    rating: number | null;
  } | null;
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? 'Something went wrong. Please try again.');
}

export async function searchGames(
  query: string,
  signal?: AbortSignal,
): Promise<GameSearchResult[]> {
  const res = await check(
    await fetch(`/api/games/search?q=${encodeURIComponent(query)}`, { signal }),
  );
  return (await res.json()).results;
}

export async function getGameDetails(igdbId: number): Promise<GameDetails> {
  const res = await check(await fetch(`/api/games/search?id=${igdbId}`));
  return (await res.json()).game;
}

export async function addManualGame(body: {
  igdbId: number;
  platform: string;
  status: AddStatus;
  hoursPlayed?: number;
  /** When it was finished or dropped (YYYY-MM-DD). */
  date?: string;
  notes?: string;
  rating?: number | null;
  /** Art picked before adding (Choose art), instead of the game's own. */
  art?: string;
}): Promise<{ id: number; name: string; warning?: string; moved?: boolean }> {
  const res = await check(
    await fetch('/api/games/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return res.json();
}

export async function updateHoursPlayed(gameId: number, hoursPlayed: number): Promise<void> {
  await check(
    await fetch(`/api/games/manual/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hoursPlayed }),
    }),
  );
}

/** Moves a Steam game you'd moved to a console back to Steam. */
export async function playOnSteam(gameId: number): Promise<void> {
  await check(
    await fetch(`/api/games/manual/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playOnSteam: true }),
    }),
  );
}

/** `keepalive` lets the request finish after the page is gone (see useManualGame). */
export async function deleteManualGame(gameId: number, keepalive = false): Promise<void> {
  await check(await fetch(`/api/games/manual/${gameId}`, { method: 'DELETE', keepalive }));
}
