/** The platform every Steam game starts on. */
export const STEAM_PLATFORM = 'PC';

/** Whether a Steam game has been moved to a console (you play it there instead). */
export function playsOnConsole(platform: string | null | undefined): boolean {
  return !!platform && platform !== STEAM_PLATFORM;
}

/** Null for a game played on Steam: "PC" on every card would be noise. */
export function consoleOf(game: { source?: string; platform?: string | null }): string | null {
  if (game.source === 'manual') return game.platform ?? null;
  return playsOnConsole(game.platform) ? game.platform! : null;
}

/** For the Games page's platform filter, so a game on Steam is PC here. */
export function platformOf(game: { source?: string; platform?: string | null }): string | null {
  return game.platform || (game.source === 'steam' ? STEAM_PLATFORM : null);
}

/**
 * Null for a console game: its stored date (which ranks Pick Up Where You Left
 * Off) only moves when hours are logged or play stops, so it could be days off.
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

const comparable = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The app's name for a console typed by hand, so one console is never listed
 * twice ("switch2" and "Nintendo Switch 2" are Switch 2). `others` are names the
 * player or the game already uses. Null for a console it doesn't know.
 */
export function knownConsole(typed: string, others: readonly string[] = []): string | null {
  const key = comparable(typed);
  if (!key) return null;
  for (const [full, short] of Object.entries(SHORT_PLATFORM_NAMES)) {
    if (comparable(full) === key || comparable(short) === key) return short;
  }
  return others.find((name) => comparable(name) === key) ?? null;
}

/** Hidden games and games on no platform aren't counted. */
export interface LibraryPlatforms {
  /** Null for an empty library. */
  main: string | null;
  count: number;
}

/** A tie goes to PC, then alphabetically, so `main` is the same on every load. */
export function libraryPlatforms(counts: ReadonlyMap<string, number>): LibraryPlatforms {
  let main: string | null = null;
  let most = 0;
  for (const [name, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (count <= 0) continue;
    if (count > most || (count === most && name === STEAM_PLATFORM)) {
      main = name;
      most = count;
    }
  }
  return { main, count: [...counts.values()].filter((count) => count > 0).length };
}

/**
 * For text (Recent activity, a row's details): every row names its platform, PC
 * too, once the library is on more than one; none on a single platform. Until
 * `library` is known, consoles only.
 */
export function platformToSay(
  game: { source?: string; platform?: string | null },
  library: LibraryPlatforms | null | undefined,
): string | null {
  if (!library) return consoleOf(game);
  return library.count > 1 ? platformOf(game) : null;
}

/**
 * For a tag on art: only a platform other than the library's main one, so the
 * tag marks the exception (in a PS5 library, a Steam game gets "PC"). Until
 * `library` is known, consoles only.
 */
export function platformTag(
  game: { source?: string; platform?: string | null },
  library: LibraryPlatforms | null | undefined,
): string | null {
  if (!library) return consoleOf(game);
  const platform = platformOf(game);
  return platform && platform !== library.main ? platform : null;
}
