'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * A list row that settles in a moment after the one above it, once its panel
 * scrolls into view (paused, at nothing, until then).
 */
export function riseIn(inView: boolean, index: number) {
  return {
    className: `animate-rise-in motion-reduce:animate-none ${inView ? '' : '[animation-play-state:paused]'}`,
    style: { animationDelay: `${index * 80}ms` },
  };
}

/** Counts up to `to` once `active`, easing out; straight to it with reduced motion. */
function useCountUp(to: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(prefersReducedMotion() ? () => setValue(to) : tick);
    return () => cancelAnimationFrame(frame);
  }, [to, active, durationMs]);
  return value;
}

/** The count is for the eye; screen readers get the real number, never a passing one. */
export function CountUpPercent({ to, active }: { to: number; active: boolean }) {
  return (
    <>
      <span aria-hidden="true">{useCountUp(to, active)}%</span>
      <span className="sr-only">{to}%</span>
    </>
  );
}
