const GAMES_VIEWS = ['grid', 'list'] as const;
export type GamesView = (typeof GAMES_VIEWS)[number];

/**
 * A cookie, not browser storage, so the server renders the page and its
 * skeleton the way it was left instead of swapping the grid for the list.
 */
export const GAMES_VIEW_COOKIE = 'games-view';

export function parseGamesView(value: string | null | undefined): GamesView {
  return (GAMES_VIEWS as readonly string[]).includes(value ?? '') ? (value as GamesView) : 'grid';
}
