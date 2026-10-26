// Client helpers for games added by hand (/api/games/search, /api/games/manual).
// They throw with the server's message, which the dialogs show as is.

export interface GameDetails {
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
  status: 'backlog' | 'queue' | 'playing' | 'finished' | 'dropped';
  hoursPlayed?: number;
  /** When it was finished or dropped (YYYY-MM-DD). */
  date?: string;
  notes?: string;
  rating?: number | null;
}): Promise<{ id: number; name: string; warning?: string }> {
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

export async function deleteManualGame(gameId: number): Promise<void> {
  await check(await fetch(`/api/games/manual/${gameId}`, { method: 'DELETE' }));
}

// IGDB's platform names, shortened to how people say them.
const SHORT_PLATFORM_NAMES: Record<string, string> = {
  'Nintendo Switch 2': 'Switch 2',
  'Nintendo Switch': 'Switch',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'PlayStation 3': 'PS3',
  'PlayStation Vita': 'PS Vita',
  'Xbox Series X|S': 'Xbox Series X|S',
  'PC (Microsoft Windows)': 'PC',
  'Nintendo 3DS': '3DS',
  'New Nintendo 3DS': 'New 3DS',
  'Nintendo DS': 'DS',
  'Wii U': 'Wii U',
  'Nintendo 64': 'N64',
  'Super Nintendo Entertainment System': 'SNES',
  'Nintendo Entertainment System': 'NES',
  'Game Boy Advance': 'GBA',
  'Nintendo GameCube': 'GameCube',
  'Family Computer': 'Famicom',
  'Family Computer Disk System': 'Famicom Disk System',
  'PlayStation 2': 'PS2',
  PlayStation: 'PS1',
  'PlayStation Portable': 'PSP',
  'Sega Mega Drive/Genesis': 'Mega Drive',
};

/**
 * The console to show for a game: only games added by hand have one (Steam
 * games are all "PC", which would be noise on every card).
 */
export function consoleOf(game: { source?: string; platform?: string | null }): string | null {
  return game.source === 'manual' ? (game.platform ?? null) : null;
}

export function shortPlatformName(name: string): string {
  return SHORT_PLATFORM_NAMES[name] ?? name;
}
