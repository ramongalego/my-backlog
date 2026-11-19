'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Where a heading counts as the one being read: a little under where a
 * link jumps it to (the page's scroll-padding-top, which clears the header),
 * so the section a link was clicked for is the one marked.
 */
const readingLine = () =>
  (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + 40;

/**
 * "On this page": the sections, numbered, as links to each. From `lg` it sits
 * beside the text and stays in view as the page scrolls, with the section
 * being read marked; below that it's a list between the opening and the
 * sections, and nothing is marked (it's out of view as soon as one is read).
 */
export function LegalContents({
  sections,
  className = '',
}: {
  sections: { id: string; title: string }[];
  className?: string;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  // The section a link was last clicked for. Near the end the page can't
  // scroll a short section's heading up to the line: while the page stays at
  // its bottom, the section clicked is the one marked, not the last.
  const clicked = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // The last heading that has reached the reading line; before any has,
      // nothing is marked (the opening is being read).
      let reached: string | null = null;
      const line = readingLine();
      for (const { id } of sections) {
        const heading = document.getElementById(id);
        if (heading && heading.getBoundingClientRect().top <= line) reached = id;
      }
      // At the very bottom the last sections can't scroll up to the line: the
      // one clicked is marked, else the last.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (!atBottom) clicked.current = null;
      setCurrent(atBottom && reached ? (clicked.current ?? sections.at(-1)!.id) : reached);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav aria-label="On this page" className={className}>
      <h2 className="text-sm font-semibold text-ink-200">On this page</h2>
      <ol className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-1">
        {sections.map((section, i) => {
          const here = section.id === current;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={here ? 'location' : undefined}
                onClick={() => (clicked.current = section.id)}
                // py-1: about 24px to tap. Marked only where the list stays in view.
                className={`block py-1 transition-colors hover:text-ink-100 ${
                  here ? 'text-ink-400 lg:text-ink-50' : 'text-ink-400'
                }`}
              >
                <span className="text-ink-500">{i + 1}.</span> {section.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
