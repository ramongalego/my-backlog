import { consoleOf } from './consoles';

/**
 * Null for a Steam game moved to a console, though it keeps its Steam id, and
 * for a game added by hand, even one Steam sells.
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
