'use client';

import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { DiaryPageSkeleton } from './Skeleton';

export default function DiaryLoading() {
  return <DiaryPageSkeleton empty={useCachedLibraryMeta()?.finishedCount === 0} />;
}
