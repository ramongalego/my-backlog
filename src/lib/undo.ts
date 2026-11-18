/**
 * Long enough to read the toast and reach the button, and the same everywhere
 * so Undo never vanishes sooner in one place than another.
 */
export const UNDO_MS = 6000;

/**
 * Call when the change is made; its Undo sends the milliseconds since
 * (`undoAgoMs`). A toast waits while its tab is in the background, and the
 * history uses this to take the Undo out of that change's event and no other.
 */
export function sinceNow(): () => number {
  const at = Date.now();
  return () => Math.max(0, Date.now() - at);
}
