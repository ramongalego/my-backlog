import { STATUS_STYLE } from './status-style';
import type { GameStatus } from './status';

/**
 * The accessible name of the control that opens a game, wherever the game is
 * listed (a card, a list row). It includes the badges shown with it, so it
 * matches what's on screen (WCAG 2.5.3, label in name), e.g. "Open details
 * for Celeste, Finished 9/10" or "Open details for Hades, Queued, Out Nov 5".
 */
export function openGameLabel(
  game: { name: string; status: GameStatus; rating: number | null },
  {
    queued = false,
    showStatus = true,
    release,
  }: {
    queued?: boolean;
    /** Off where the page is filtered to one status, so the badge isn't shown. */
    showStatus?: boolean;
    /** "Out Nov 5", for a game that isn't out yet. */
    release?: string | null;
  } = {},
): string {
  const rated = (game.status === 'finished' || game.status === 'dropped') && game.rating != null;
  const badge = queued
    ? 'Queued'
    : showStatus && game.status !== 'backlog'
      ? STATUS_STYLE[game.status].label
      : null;
  // The badges read in on-screen order as one phrase ("Finished 9/10").
  const badges = [badge, rated ? `${game.rating}/10` : null].filter(Boolean).join(' ');
  return [`Open details for ${game.name}`, badges, release].filter(Boolean).join(', ');
}

/**
 * What a game's button is called in Select mode, where it ticks the game
 * rather than opening it ("Select Hades"), or why it can't be ticked.
 */
export function selectGameLabel(
  game: { name: string },
  selection: { selectable: boolean },
  queued?: boolean,
): string {
  if (selection.selectable) return `Select ${game.name}`;
  return `${game.name}, ${queued ? 'queued' : 'playing'}: change it from its own dialog`;
}
