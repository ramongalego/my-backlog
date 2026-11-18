'use client';

import { ConsoleBadge } from './ConsoleBadge';
import { ReleaseBadge } from './ReleaseBadge';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';

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
      {/* Keeps the two tags apart as text (it draws nothing in a flex row). */}{' '}
      <ReleaseBadge releaseDate={releaseDate} />
    </div>
  );
}
