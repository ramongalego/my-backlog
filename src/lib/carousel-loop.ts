// The arithmetic behind GameCarousel's endless loop, kept pure so it's tested
// on its own. The carousel renders copies of the list around the real one and
// slides across them; after each slide it jumps, without animating, to the
// same games in the real copy. So it never runs out of cards to show.

/** `i` wrapped into 0..n-1, for negative numbers too. */
export function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * How many copies of the list go before and after the real one. A slide
 * starts anywhere in the real copy and moves a page (`step` cards) either
 * way, and `visible` cards show at once (a page plus any peeking card). So
 * there must be a page of cards before the start, and a page plus a screenful
 * beyond the end.
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

/** Which rendered positions are on screen when the first visible game is `start`. */
export function isOnScreen(position: number, start: number, perPage: number): boolean {
  return position >= start && position < start + perPage;
}

/**
 * Turns horizontal wheel events into whole-page swipes. A trackpad sends a
 * stream of small deltas for one swipe, then keeps sending shrinking ones
 * while it coasts; one swipe should move one page. So deltas add up until they
 * pass `threshold` (one page), the rest of that stream is ignored, and a pause
 * longer than `quietMs` starts a new swipe.
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
