'use client';

import { ConsoleBadge } from './ConsoleBadge';
import { ReleaseBadge } from './ReleaseBadge';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';

/**
 * The tags along the bottom of a game's art: the console it's played on, and
 * "Out Nov 5" for a game that isn't out yet. Nothing when there's neither.
 */
export function ArtTags({
  platform,
  releaseDate,
}: {
  platform?: string | null;
  releaseDate?: string | null;
}) {
  const zone = useReleaseZone();
  if (!platform && !upcomingRelease(releaseDate, undefined, zone)) return null;
  return (
    <div className="absolute bottom-2 left-2 right-2 flex gap-1">
      {platform && <ConsoleBadge platform={platform} />}
      <ReleaseBadge releaseDate={releaseDate} />
    </div>
  );
}
