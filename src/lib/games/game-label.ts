import { STATUS_STYLE } from './status-style';
import type { GameStatus } from './status';

/**
 * The accessible name of the control that opens a game, wherever the game is
 * listed (a card, a list row). It includes the badges shown with it, so it
 * matches what's on screen (WCAG 2.5.3, label in name), e.g. "Open details
 * for Celeste, Finished 9/10" or "Open details for Hades, Queued, PS5, Out
 * Nov 5". The order is the order on screen: a name only matches what's shown
 * if the words run the same way.
 */
export function openGameLabel(
  game: { name: string; status: GameStatus; rating: number | null },
  {
    queued = false,
    showStatus = true,
    console,
    release,
  }: {
    queued?: boolean;
    /** Off where the page is filtered to one status, so the badge isn't shown. */
    showStatus?: boolean;
    /** The console tag on the art, where the control includes the art. */
    console?: string | null;
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
  return withArtTags([`Open details for ${game.name}`, badges].filter(Boolean).join(', '), {
    console,
    release,
  });
}

/**
 * A name with the tags drawn along the bottom of the game's art added, in the
 * order they're drawn (ArtTags): the console, then "Out Nov 5". For a control
 * that contains the art, so its name has every word shown inside it.
 */
export function withArtTags(
  label: string,
  { console, release }: { console?: string | null; release?: string | null },
): string {
  return [label, console, release].filter(Boolean).join(', ');
}

/**
 * What a game's button is called in Select mode, where it ticks the game
 * rather than opening it ("Select Hades"), or why it can't be ticked.
 */
export function selectGameLabel(
  game: { name: string; status: GameStatus; rating: number | null },
  selection: { selectable: boolean },
  queued?: boolean,
  /**
   * On a card, where the button holds the art: what's drawn on it, so the
   * name has those words too (as openGameLabel's does). A list row's button
   * is only the game's name.
   */
  art?: { showStatus?: boolean; console?: string | null; release?: string | null },
): string {
  if (!selection.selectable) {
    // Its badge says the same, so only the art's tags are added.
    const why = withArtTags(`${game.name}, ${queued ? 'queued' : 'playing'}`, art ?? {});
    return `${why}: change it from its own dialog`;
  }
  if (!art) return `Select ${game.name}`;
  return openGameLabel(game, { queued, ...art }).replace('Open details for', 'Select');
}
