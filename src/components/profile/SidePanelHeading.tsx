import { SectionLabel } from '@/components/layout/Page';
import { SIDE_PANEL_HEADING } from './profile-layout';

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
  /**
   * Only looked at: what's under the heading says it to a screen reader. Left
   * out where a count wouldn't say anything (Activity, whose start isn't drawn).
   */
  count?: number;
  /** The room under the line. */
  className?: string;
}) {
  return (
    <div className={`${SIDE_PANEL_HEADING} ${className}`}>
      <SectionLabel>{children}</SectionLabel>
      {count != null && (
        <span className="text-xs tabular-nums text-ink-500" aria-hidden="true">
          {count}
        </span>
      )}
    </div>
  );
}
