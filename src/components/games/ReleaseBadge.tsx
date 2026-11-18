'use client';

import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';

export function ReleaseBadge({ releaseDate }: { releaseDate: string | null | undefined }) {
  const upcoming = upcomingRelease(releaseDate, undefined, useReleaseZone());
  if (!upcoming) return null;
  return (
    <Tooltip
      content={<TooltipText title={upcoming.detail} />}
      // The tag sits on art that is usually a button, named with this date.
      described={false}
      className="h-5 max-w-full rounded-md bg-ink-950/90 px-1.5 text-xs font-medium text-ink-100"
    >
      <span className="truncate">{upcoming.label}</span>
    </Tooltip>
  );
}
