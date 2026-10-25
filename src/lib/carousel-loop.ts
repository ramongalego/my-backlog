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
 * starts anywhere in the real copy and moves a full page either way, so
 * there must be at least a page of cards beyond both ends, plus a page more
 * on the right for the cards visible at the far end of the real copy.
 */
export function loopCopies(count: number, perPage: number): { before: number; after: number } {
  return {
    before: Math.ceil(perPage / count),
    after: Math.ceil((2 * perPage - 1) / count),
  };
}

/** Which rendered positions are on screen when the first visible game is `start`. */
export function isOnScreen(position: number, start: number, perPage: number): boolean {
  return position >= start && position < start + perPage;
}
