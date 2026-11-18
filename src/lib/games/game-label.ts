import { STATUS_STYLE } from './status-style';
import type { GameStatus } from './status';

/**
 * Includes the badges shown with the game, in on-screen order, so the name
 * matches what's shown (WCAG 2.5.3, label in name): "Open details for Celeste,
 * Finished 9/10".
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
 * For a control that contains the art, so its name has every word drawn on it,
 * in the order ArtTags draws them.
 */
export function withArtTags(
  label: string,
  { console, release }: { console?: string | null; release?: string | null },
): string {
  return [label, console, release].filter(Boolean).join(', ');
}

/** In Select mode the button ticks the game ("Select Hades"), or says why it can't. */
export function selectGameLabel(
  game: { name: string; status: GameStatus; rating: number | null },
  selection: { selectable: boolean },
  queued?: boolean,
  /** What's drawn on the art, where the button holds it (a card, not a list row). */
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
