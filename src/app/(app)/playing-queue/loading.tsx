'use client';

import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { QueuePageSkeleton } from './Skeleton';

export default function PlayingQueueLoading() {
  // Whether a game is being played, if an earlier page this visit loaded it:
  // its panel tops the queue. Not known yet, it's the usual case.
  const playing = useQueryClient()
    .getQueriesData({ queryKey: [...queryKeys.games.all, 'playing'] })
    .map(([, data]) => data)
    .find((data) => data !== undefined);
  return <QueuePageSkeleton playing={playing !== null} />;
}
