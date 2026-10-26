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

/** A Steam game played on a console: its hours are yours to enter, and it can go back to Steam. */
export function isMovedSteamGame(game: { source?: string; platform?: string | null }): boolean {
  return game.source === 'steam' && playsOnConsole(game.platform);
}
