// GameCarousel's endless loop renders copies of the list around the real one
// and, after each slide, jumps without animating back into the real copy.

/** `i` wrapped into 0..n-1, for negative numbers too. */
export function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * A slide moves `step` cards either way from anywhere in the real copy and
 * `visible` cards show at once (with any peeking card), so a page must fit
 * before the start and a page plus a screenful after the end.
 */
export function loopCopies(
  count: number,
  step: number,
  visible = step,
): { before: number; after: number } {
  return {
    before: Math.ceil(step / count),
    after: Math.ceil((step + visible - 1) / count),
  };
}

export function isOnScreen(position: number, start: number, perPage: number): boolean {
  return position >= start && position < start + perPage;
}

/**
 * One trackpad swipe sends many small deltas, then shrinking ones as it coasts,
 * and should move one page: deltas add up to `threshold`, the rest is ignored,
 * and a pause over `quietMs` starts a new swipe.
 */
export function createSwipeTracker({ threshold = 40, quietMs = 200 } = {}) {
  let total = 0;
  let used = false;
  let lastTime = -Infinity;
  return (deltaX: number, time: number): 1 | -1 | 0 => {
    if (time - lastTime > quietMs) {
      total = 0;
      used = false;
    }
    lastTime = time;
    if (used) return 0;
    total += deltaX;
    if (Math.abs(total) < threshold) return 0;
    used = true;
    return total > 0 ? 1 : -1;
  };
}
