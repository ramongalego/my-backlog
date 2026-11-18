'use client';

import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const EDGE_GAP = 8;

/**
 * Shows instantly on hover or a tap. The trigger should make sense without it;
 * screen readers get the text through aria-describedby.
 *
 * Triggers take focus on tap (tabIndex -1) but aren't tab stops: a grid of game
 * cards would gain three stops per card. On a touchscreen the tap stays with the
 * tooltip instead of reaching what's around it, like a card that opens.
 */
export function Tooltip({
  content,
  children,
  className = '',
  described = true,
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * Off inside a button whose name already says the same (a tag on a game's art):
   * the description would be button text its name lacks, and nothing reads it there.
   */
  described?: boolean;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const pointerType = useRef('mouse');

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rect);
  };
  const hide = () => setAnchor(null);

  return (
    <span
      ref={triggerRef}
      tabIndex={-1}
      aria-describedby={described ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType;
      }}
      onClick={(e) => {
        if (pointerType.current !== 'touch' && pointerType.current !== 'pen') return;
        // A button inside the trigger (the queue's Move to top) still works.
        const inner = (e.target as Element).closest('button, a');
        if (inner && triggerRef.current?.contains(inner)) return;
        e.preventDefault();
        e.stopPropagation();
        show();
      }}
      className={`inline-flex items-center gap-1 rounded-sm cursor-default focus:outline-none ${className}`}
    >
      {children}
      {/* The description screen readers announce; the visible bubble below is decorative. */}
      {described && (
        <span id={id} role="tooltip" className="sr-only">
          {content}
        </span>
      )}
      {anchor && (
        <TooltipBubble anchor={anchor} onDismiss={hide}>
          {content}
        </TooltipBubble>
      )}
    </span>
  );
}

/**
 * Centered above `anchor` (an element's box on screen), or below when there's no
 * room. Portaled with fixed positioning so a clipping container (content-visibility,
 * a carousel) can't cut it off. aria-hidden: give screen readers the text some other
 * way. Scrolling or resizing dismisses it, since a fixed bubble would drift.
 */
export function TooltipBubble({
  anchor,
  onDismiss,
  children,
}: {
  anchor: { left: number; top: number; bottom: number; width: number };
  onDismiss: () => void;
  children: ReactNode;
}) {
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const width = bubble.offsetWidth;
    const left = Math.min(
      Math.max(anchor.left + anchor.width / 2 - width / 2, EDGE_GAP),
      window.innerWidth - width - EDGE_GAP,
    );
    bubble.style.left = `${left}px`;
    const above = anchor.top - bubble.offsetHeight - EDGE_GAP;
    // A tall bubble near the top of the screen would start off screen: it goes below.
    bubble.style.top = `${above >= EDGE_GAP ? above : anchor.bottom + EDGE_GAP}px`;
  }, [anchor]);

  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const hide = () => dismiss();
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  return createPortal(
    <span
      ref={bubbleRef}
      aria-hidden="true"
      className="fixed z-50 w-max max-w-60 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-left text-xs leading-snug text-ink-300 shadow-lg shadow-black/40 pointer-events-none [overflow-wrap:anywhere]"
      style={{ left: -9999, top: -9999 }}
    >
      {children}
    </span>,
    document.body,
  );
}

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
