'use client';

import { useRef, useState } from 'react';
import { TooltipBubble } from './Tooltip';

/**
 * Text cut off with an ellipsis (or clamped to a few lines) that shows the
 * whole of itself the moment the pointer is on it, in the app's tooltip
 * bubble. Only when it's actually cut: a name that fits shows nothing, and a
 * name that wraps on a phone and is cut on a desktop does both.
 *
 * A mouse thing: there's no hover on a touchscreen, and the text is all there
 * for a screen reader already, so the bubble is decorative. It replaces the
 * browser's `title` tooltip, which takes a second to come up.
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
