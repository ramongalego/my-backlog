'use client';

import { GamesPageSkeleton } from './Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { useGamesView } from '@/hooks/useGamesView';

export default function GamesLoading() {
  const [view] = useGamesView();
  return <GamesPageSkeleton empty={useCachedLibraryMeta()?.gameCount === 0} view={view} />;
}
