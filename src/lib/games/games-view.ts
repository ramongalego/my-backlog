// How the Games page lays out the library: art tiles, or compact rows.

const GAMES_VIEWS = ['grid', 'list'] as const;
export type GamesView = (typeof GAMES_VIEWS)[number];

/**
 * The cookie the choice is kept in. A cookie rather than browser storage, so
 * the server renders the page (and its loading skeleton) the way it was left,
 * instead of drawing the grid and swapping it for the list.
 */
export const GAMES_VIEW_COOKIE = 'games-view';

/** The view a cookie's value asks for: the grid unless it's a known view. */
export function parseGamesView(value: string | null | undefined): GamesView {
  return (GAMES_VIEWS as readonly string[]).includes(value ?? '') ? (value as GamesView) : 'grid';
}
