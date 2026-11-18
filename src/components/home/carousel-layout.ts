// Shared by GameCarousel and its skeleton, outside the 'use client' module so
// server components (Home's loading.tsx) can use them too.

// The fraction is the next card peeking in under the fade: it shows there's
// more, and becomes the first card of the next page, so a jump keeps your place.
export const CAROUSEL_PER_PAGE =
  '[--per-page:1.4] sm:[--per-page:2.3] md:[--per-page:3.3] lg:[--per-page:4.3] xl:[--per-page:5.3]';

// Inside the track 100% is the row's width, for flex-basis and for translateX
// (which is relative to the track itself).
export const CAROUSEL_CARD_WIDTH = 'calc((100% - (var(--per-page) - 1) * 1rem) / var(--per-page))';

/** The fade over the right edge that says the row has more. */
export const CAROUSEL_FADE_CLASS =
  'pointer-events-none absolute inset-y-0 right-0 max-sm:-right-4 z-[5] w-24';
export const CAROUSEL_FADE_STYLE = {
  background: 'linear-gradient(to right, transparent, var(--color-ink-950))',
};
