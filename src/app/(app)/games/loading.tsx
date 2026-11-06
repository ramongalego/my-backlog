'use client';

import { GamesPageSkeleton } from '@/components/games/GamesPageSkeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';

export default function GamesLoading() {
  return <GamesPageSkeleton empty={useCachedLibraryMeta()?.gameCount === 0} />;
}
