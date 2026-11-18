'use client';

import { useEffect, useRef, useState } from 'react';

/** Stays true once in view, so an entrance plays once, not every time it scrolls past. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    // Without the observer (old browsers, tests), show it straight away.
    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setInView(true));
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      // So the motion is seen rather than finished below the fold.
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}

/** A chart bar that grows in once its chart is in view, paused at nothing until then. */
export function growBar(axis: 'x' | 'y', inView: boolean, index: number) {
  return {
    className: `${axis === 'x' ? 'origin-left animate-grow-x' : 'origin-bottom animate-grow-y'} motion-reduce:animate-none ${inView ? '' : '[animation-play-state:paused]'}`,
    style: { animationDelay: `${Math.min(index, 11) * 35}ms` },
  };
}
