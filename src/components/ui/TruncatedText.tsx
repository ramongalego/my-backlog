'use client';

import { useRef, useState } from 'react';
import { TooltipBubble } from './Tooltip';

/**
 * Shows the whole text in the tooltip bubble on hover, only while it's actually cut.
 * Mouse only: touchscreens can't hover and screen readers have the full text. It
 * replaces the browser's `title` tooltip, which takes a second to come up.
 */
export function TruncatedText({
  children,
  className = '',
  as: Tag = 'span',
}: {
  children: string;
  /** The classes that cut it: `truncate`, `lg:truncate`, `line-clamp-2`. */
  className?: string;
  as?: 'span' | 'p';
}) {
  const ref = useRef<HTMLElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const show = () => {
    const text = ref.current;
    if (!text) return;
    // A tap sends mouse events too, and the bubble would stay until the next
    // scroll: only for a pointer that can hover.
    if (window.matchMedia?.('(hover: none)').matches) return;
    const cut =
      text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1;
    if (cut) setAnchor(text.getBoundingClientRect());
  };

  return (
    <Tag
      ref={ref as React.Ref<HTMLParagraphElement & HTMLSpanElement>}
      onMouseEnter={show}
      onMouseLeave={() => setAnchor(null)}
      className={className}
    >
      {children}
      {anchor && (
        <TooltipBubble anchor={anchor} onDismiss={() => setAnchor(null)}>
          <span className="font-medium text-ink-50">{children}</span>
        </TooltipBubble>
      )}
    </Tag>
  );
}
