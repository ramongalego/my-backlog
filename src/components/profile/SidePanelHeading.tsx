import { SectionLabel } from '@/components/layout/Page';

/**
 * The heading of a panel beside the profile (Platforms, Ratings): its name,
 * how many it holds at the far end, and a hairline under both, so the count
 * isn't read as part of what is under it.
 */
export function SidePanelHeading({
  children,
  count,
  className = 'mb-4',
}: {
  children: string;
  /** Only looked at: what's under the heading says it to a screen reader. */
  count: number;
  /** The room under the line. */
  className?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-ink-800 pb-1.5 ${className}`}
    >
      <SectionLabel>{children}</SectionLabel>
      <span className="text-xs tabular-nums text-ink-500" aria-hidden="true">
        {count}
      </span>
    </div>
  );
}
