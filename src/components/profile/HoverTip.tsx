/**
 * Put on what a HoverTip sits over: hovering it shows the tip. The tip is
 * placed against it, so it must be the tip's positioned parent.
 */
export const HOVER_TIP_TARGET = 'group/tip relative';

/**
 * What a mark in a side panel's chart says on hover (a day of Activity, a
 * rating's bar): shown at once, unlike the browser's own tooltip, above the
 * mark. Drawn only: the chart's name says it all to a screen reader. CSS
 * alone, so it works on the page other people get, which is drawn on the
 * server.
 */
export function HoverTip({
  title,
  detail,
  align = 'center',
}: {
  title: string;
  detail: string;
  /**
   * Which edge of the mark it lines up with: the start for marks at a chart's
   * left end and the end at its right, so it stays inside the panel.
   */
  align?: 'start' | 'center' | 'end';
}) {
  const place =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-md bg-ink-700 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg shadow-black/40 group-hover/tip:block ${place}`}
    >
      <span className="block font-medium text-ink-50">{title}</span>
      <span className="block text-ink-300">{detail}</span>
    </span>
  );
}
