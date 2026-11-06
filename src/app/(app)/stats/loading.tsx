'use client';

import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { StatsPageSkeleton } from './Skeleton';

export default function StatsLoading() {
  return <StatsPageSkeleton empty={useCachedLibraryMeta()?.gameCount === 0} />;
}
