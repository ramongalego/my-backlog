'use client';

import { GamesPageSkeleton } from './Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';

export default function GamesLoading() {
  return <GamesPageSkeleton empty={useCachedLibraryMeta()?.gameCount === 0} />;
}
