import { consoleOf } from './consoles';

/**
 * The game's Steam store page, for a game you play on Steam; null otherwise.
 * A Steam game moved to a console keeps its Steam id, but you don't play it
 * there, so it doesn't link to Steam (nor does a game added by hand, even one
 * Steam sells).
 */
export function steamStoreUrl(game: {
  app_id: number | null | undefined;
  source?: string;
  platform?: string | null;
}): string | null {
  return game.app_id && !consoleOf(game)
    ? `https://store.steampowered.com/app/${game.app_id}/`
    : null;
}
