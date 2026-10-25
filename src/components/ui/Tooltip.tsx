'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const EDGE_GAP = 8;

/**
 * A small custom tooltip that shows instantly on hover, keyboard focus, or a
 * tap (taps focus the trigger). Use it for compact indicators whose meaning
 * needs a word of explanation; the trigger's visible content should still make
 * sense without it.
 *
 * The bubble renders at the page level with fixed positioning, so containers
 * that clip their contents (game cards use content-visibility, carousels
 * scroll) can't cut it off, and it's nudged to stay inside the viewport.
 */
export function Tooltip({
  content,
  children,
  className = '',
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
  };
  const hide = () => setAnchor(null);

  // Centre the bubble over the trigger, then keep it on screen.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;
    const width = bubble.offsetWidth;
    const left = Math.min(
      Math.max(anchor.x - width / 2, EDGE_GAP),
      window.innerWidth - width - EDGE_GAP,
    );
    bubble.style.left = `${left}px`;
    bubble.style.top = `${anchor.y - bubble.offsetHeight - EDGE_GAP}px`;
  }, [anchor]);

  // A fixed bubble would drift away from its trigger, so scrolling hides it.
  useEffect(() => {
    if (!anchor) return;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [anchor]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      aria-describedby={id}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`inline-flex items-center gap-1 rounded-sm cursor-default focus-visible:outline-offset-1 ${className}`}
    >
      {children}
      {/* The description screen readers announce; the visible bubble below is decorative. */}
      <span id={id} role="tooltip" className="sr-only">
        {content}
      </span>
      {anchor &&
        createPortal(
          <span
            ref={bubbleRef}
            aria-hidden="true"
            className="fixed z-50 w-max max-w-60 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-left text-xs leading-snug text-ink-300 shadow-lg shadow-black/40 pointer-events-none"
            style={{ left: -9999, top: -9999 }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** Two-line tooltip body: a short heading and an optional detail line. */
export function TooltipText({
  title,
  detail,
  titleClassName = 'text-ink-50',
}: {
  title: ReactNode;
  detail?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <>
      <span className={`block font-medium ${titleClassName}`}>{title}</span>
      {detail && <span className="block text-ink-400">{detail}</span>}
    </>
  );
}
