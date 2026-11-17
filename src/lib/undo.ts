/**
 * How long every Undo toast stays up. Long enough to read the toast and reach
 * the button, and the same everywhere so Undo never vanishes sooner in one
 * place than another.
 */
export const UNDO_MS = 6000;

/**
 * Times an Undo. Called when a change is made, it gives back a function that
 * says how many milliseconds ago that was: every Undo that changes a game or
 * the queue sends it along (`undoAgoMs`). A toast waits while its tab is in
 * the background, so an Undo can come long after its change, and the history
 * uses the time to take the Undo out of that change's event and no other.
 */
export function sinceNow(): () => number {
  const at = Date.now();
  return () => Math.max(0, Date.now() - at);
}
