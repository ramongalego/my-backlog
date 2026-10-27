'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Whether the element has come into view yet: once it has, it stays true, so
 * an entrance plays once rather than every time it scrolls past.
 */
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
      // A little of it showing, so the motion is seen rather than finished
      // below the fold.
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}

/**
 * The classes and style for one bar of a chart that grows into place when its
 * chart comes into view, the bars a moment apart. Paused (at nothing) until
 * then; with reduced motion, simply there.
 */
export function growBar(axis: 'x' | 'y', inView: boolean, index: number) {
  return {
    className: `${axis === 'x' ? 'origin-left animate-grow-x' : 'origin-bottom animate-grow-y'} motion-reduce:animate-none ${inView ? '' : '[animation-play-state:paused]'}`,
    style: { animationDelay: `${Math.min(index, 11) * 35}ms` },
  };
}
