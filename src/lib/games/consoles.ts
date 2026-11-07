// Which console a game is played on. Shared by the server (sync, add route)
// and the client (tags on art, the detail dialog).

/** The platform every Steam game starts on. */
export const STEAM_PLATFORM = 'PC';

/** Whether a Steam game has been moved to a console (you play it there instead). */
export function playsOnConsole(platform: string | null | undefined): boolean {
  return !!platform && platform !== STEAM_PLATFORM;
}

/**
 * The console to show for a game: a game added by hand's console, or the one
 * a Steam game was moved to. None for Steam games played on Steam ("PC" on
 * every card would be noise).
 */
export function consoleOf(game: { source?: string; platform?: string | null }): string | null {
  if (game.source === 'manual') return game.platform ?? null;
  return playsOnConsole(game.platform) ? game.platform! : null;
}

/**
 * The last-played date to show for a game: Steam's, for a game played on
 * Steam. A console game's date is still stored (it ranks Pick Up Where You
 * Left Off) but not shown: it only moves when hours are logged or play stops,
 * so "Last played 7 days ago" could be wrong about a game played today.
 */
export function steamLastPlayed(game: {
  source?: string;
  platform?: string | null;
  last_played_at?: string | null;
}): string | null {
  return consoleOf(game) ? null : (game.last_played_at ?? null);
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

export function shortPlatformName(name: string): string {
  return SHORT_PLATFORM_NAMES[name] ?? name;
}
