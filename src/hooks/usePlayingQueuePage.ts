'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { celebrateGameFinished } from '@/lib/confetti';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';
import { fetchCurrentlyPlaying } from '@/lib/games/currentGame';
import { updateGameStatus } from '@/lib/games/status';
import { fetchCompletionCounts, buildCompletionSummary } from '@/lib/games/completion';
import { useLibraryRefresh } from './useLibraryRefresh';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { GameWithImage, QueueItem } from '@/types/games';
import type { GameSummaryData } from '@/components/games/GameSummaryModal';

interface StatusModal {
  action: 'finished' | 'dropped';
}

interface UsePlayingQueuePageReturn {
  currentlyPlaying: GameWithImage | null;
  queue: QueueItem[];
  isLoading: boolean;
  isStatusLoading: boolean;
  statusModal: StatusModal | null;
  gameSummary: GameSummaryData | null;
  handleFinish: () => void;
  handleDrop: () => void;
  handleCancel: () => void;
  handleMoveToBacklog: () => void;
  handleConfirm: (status: string, date: string, notes: string, rating: number | null) => void;
  handleCloseStatusModal: () => void;
  handleCloseSummary: () => void;
  handleRemoveFromQueue: (appId: number) => void;
  handlePickFromQueue: (appId: number) => void;
  handleReorder: (appIds: number[]) => void;
}

const ANONYMOUS_PLAYING_KEY = [...queryKeys.games.all, 'playing', 'anonymous'] as const;
const ANONYMOUS_QUEUE_KEY = [...queryKeys.queue.all, 'list', 'anonymous'] as const;

async function fetchQueue(): Promise<QueueItem[]> {
  const res = await fetch('/api/queue');
  if (!res.ok) return [];
  const data = await res.json();
  return data.queue ?? [];
}

async function assertOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error ? `: ${body.error}` : '';
  } catch {
    // non-JSON body — ignore
  }
  throw new Error(`${action} failed (${res.status})${detail}`);
}

interface ConfirmInput {
  status: string;
  date: string;
  notes: string;
  rating: number | null;
}

interface ConfirmResult {
  finishedGame: GameWithImage;
  promoted: GameWithImage | null;
  gamesFinished: number;
  totalGames: number;
  status: string;
  rating: number | null;
}

export function usePlayingQueuePage(): UsePlayingQueuePageReturn {
  const queryClient = useQueryClient();
  const { gamesAndQueue: invalidateGamesAndQueue, queue: invalidateQueue } = useInvalidateQueries();
  const { refreshIfStale } = useLibraryRefresh();
  const { user, authResolved } = useAuth();
  const userId = user?.id ?? null;

  const playingKey = userId ? queryKeys.games.playing(userId) : ANONYMOUS_PLAYING_KEY;
  const queueKey = userId ? queryKeys.queue.list(userId) : ANONYMOUS_QUEUE_KEY;

  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);

  const { data: currentlyPlaying = null, isLoading: isPlayingLoading } = useQuery({
    queryKey: playingKey,
    queryFn: () => fetchCurrentlyPlaying(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const { data: queue = [], isLoading: isQueueLoading } = useQuery({
    queryKey: queueKey,
    queryFn: fetchQueue,
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = !authResolved || (!!userId && (isPlayingLoading || isQueueLoading));

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async (appId: number) => {
      const res = await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });
      await assertOk(res, 'Remove from queue');
    },
    onMutate: async (appId) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
      queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) =>
        (old ?? []).filter((q) => q.app_id !== appId),
      );
      return { previous };
    },
    onError: (err, _appId, context) => {
      Sentry.captureException(err);
      if (context?.previous) queryClient.setQueryData(queueKey, context.previous);
      toast.error('Failed to remove game from queue');
    },
    onSettled: () => invalidateQueue(),
  });

  const reorderMutation = useMutation({
    mutationFn: async (appIds: number[]) => {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: appIds }),
      });
      await assertOk(res, 'Reorder queue');
    },
    onMutate: async (appIds) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
      queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) => {
        if (!old) return old;
        const byId = new Map(old.map((q) => [q.app_id, q]));
        // Unknown id means the cache and the drag state diverged; skip the
        // optimistic pass and let onSettled's invalidation catch up.
        if (!appIds.every((id) => byId.has(id))) return old;
        return appIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
      });
      return { previous };
    },
    onError: (err, _appIds, context) => {
      Sentry.captureException(err);
      if (context?.previous) queryClient.setQueryData(queueKey, context.previous);
      toast.error('Failed to reorder queue');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queueKey }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (game: GameWithImage) => {
      await updateGameStatus(game.app_id, 'backlog');
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: game.app_id }),
      });
      await assertOk(res, 'Add to queue');
    },
    onMutate: async (game) => {
      await queryClient.cancelQueries({ queryKey: playingKey });
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previousPlaying = queryClient.getQueryData<GameWithImage | null>(playingKey);
      const previousQueue = queryClient.getQueryData<QueueItem[]>(queueKey);

      queryClient.setQueryData(playingKey, null);
      queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) => [
        ...(old ?? []),
        {
          id: -1,
          app_id: game.app_id,
          position: (old ?? []).length,
          game: {
            name: game.name,
            header_image: game.header_image,
            playtime_forever: game.playtime_forever,
            main_story_hours: game.main_story_hours,
            steam_review_score: game.steam_review_score ?? null,
            deck_compat: game.deck_compat ?? null,
          },
        },
      ]);

      return { previousPlaying, previousQueue };
    },
    onError: (err, _game, context) => {
      Sentry.captureException(err);
      console.error('Failed to move game to queue:', err);
      toast.error('Failed to move game to queue');
      if (context?.previousPlaying !== undefined) {
        queryClient.setQueryData(playingKey, context.previousPlaying);
      }
      if (context?.previousQueue !== undefined) {
        queryClient.setQueryData(queueKey, context.previousQueue);
      }
    },
    onSettled: () => invalidateGamesAndQueue(),
  });

  const confirmMutation = useMutation<ConfirmResult, Error, ConfirmInput>({
    mutationFn: async ({ status, date, notes, rating }) => {
      if (!currentlyPlaying) throw new Error('No currently playing game');
      if (!userId) throw new Error('Not authenticated');
      const finishedGame = currentlyPlaying;

      await updateGameStatus(finishedGame.app_id, status, {
        finishedAt: status === 'finished' ? date : undefined,
        droppedAt: status === 'dropped' ? date : undefined,
        notes,
        rating,
      });

      const supabase = createClient();
      const [counts, promotedGame] = await Promise.all([
        fetchCompletionCounts(supabase, userId),
        promoteNextFromQueue(userId, supabase),
      ]);

      return {
        finishedGame,
        promoted: promotedGame,
        gamesFinished: counts.gamesFinished,
        totalGames: counts.totalGames,
        status,
        rating,
      };
    },
    onSuccess: ({ finishedGame, promoted, gamesFinished, totalGames, status, rating }) => {
      queryClient.setQueryData(playingKey, promoted);
      if (promoted) {
        queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) =>
          (old ?? []).filter((q) => q.app_id !== promoted.app_id),
        );
      }

      if (status === 'finished') {
        setGameSummary(
          buildCompletionSummary({
            finishedGame,
            promoted,
            counts: { gamesFinished, totalGames },
            rating,
          }),
        );
        celebrateGameFinished();
      }
    },
    onError: (err, variables) => {
      Sentry.captureException(err);
      console.error(`Failed to ${variables.status} game:`, err);
      toast.error(`Failed to ${variables.status} game`);
    },
    onSettled: () => invalidateGamesAndQueue(),
  });

  const pickMutation = useMutation({
    mutationFn: async (appId: number) => {
      if (!userId) throw new Error('Not authenticated');

      await updateGameStatus(appId, 'playing');
      const res = await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });
      await assertOk(res, 'Remove from queue');

      return fetchCurrentlyPlaying(userId);
    },
    onMutate: async (appId) => {
      await queryClient.cancelQueries({ queryKey: playingKey });
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previousPlaying = queryClient.getQueryData<GameWithImage | null>(playingKey);
      const previousQueue = queryClient.getQueryData<QueueItem[]>(queueKey);

      // Read from the cache, not the render closure, so rapid picks can't
      // resolve against a stale queue snapshot.
      const item = (previousQueue ?? []).find((q) => q.app_id === appId);
      if (!item) return { previousPlaying: undefined, previousQueue: undefined };

      queryClient.setQueryData(playingKey, {
        app_id: item.app_id,
        name: item.game.name,
        header_image: item.game.header_image,
        main_story_hours: item.game.main_story_hours,
        playtime_forever: item.game.playtime_forever,
        started_at: null,
        steam_review_score: item.game.steam_review_score,
        deck_compat: item.game.deck_compat ?? null,
      });
      queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) =>
        (old ?? []).filter((q) => q.app_id !== appId),
      );

      return { previousPlaying, previousQueue };
    },
    onSuccess: (freshGame) => {
      if (freshGame) queryClient.setQueryData(playingKey, freshGame);
    },
    onError: (err, _appId, context) => {
      Sentry.captureException(err);
      console.error('Failed to pick game from queue:', err);
      toast.error('Failed to start playing');
      if (context?.previousPlaying !== undefined) {
        queryClient.setQueryData(playingKey, context.previousPlaying);
      }
      if (context?.previousQueue !== undefined) {
        queryClient.setQueryData(queueKey, context.previousQueue);
      }
    },
    onSettled: () => invalidateGamesAndQueue(),
  });

  const backlogMutation = useMutation({
    mutationFn: async (game: GameWithImage) => {
      await updateGameStatus(game.app_id, 'backlog');
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: playingKey });
      const previousPlaying = queryClient.getQueryData<GameWithImage | null>(playingKey);
      queryClient.setQueryData(playingKey, null);
      return { previousPlaying };
    },
    onError: (err, _game, context) => {
      Sentry.captureException(err);
      console.error('Failed to move game to backlog:', err);
      toast.error('Failed to move game to backlog');
      if (context?.previousPlaying !== undefined) {
        queryClient.setQueryData(playingKey, context.previousPlaying);
      }
    },
    onSettled: () => invalidateGamesAndQueue(),
  });

  const isStatusLoading =
    cancelMutation.isPending ||
    confirmMutation.isPending ||
    pickMutation.isPending ||
    backlogMutation.isPending;

  useEffect(() => {
    if (isLoading) return;
    refreshIfStale();
  }, [isLoading, refreshIfStale]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleFinish = () => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'finished' });
  };

  const handleDrop = () => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'dropped' });
  };

  const handleCloseStatusModal = () => setStatusModal(null);
  const handleCloseSummary = () => setGameSummary(null);

  const handleCancel = () => {
    if (!currentlyPlaying) return;
    cancelMutation.mutate(currentlyPlaying);
  };

  const handleMoveToBacklog = () => {
    if (!currentlyPlaying) return;
    backlogMutation.mutate(currentlyPlaying);
  };

  const handleConfirm = (status: string, date: string, notes: string, rating: number | null) => {
    if (!currentlyPlaying) return;
    setStatusModal(null);
    confirmMutation.mutate({ status, date, notes, rating });
  };

  const handleRemoveFromQueue = (appId: number) => {
    removeMutation.mutate(appId);
  };

  const handlePickFromQueue = (appId: number) => {
    pickMutation.mutate(appId);
  };

  const handleReorder = (appIds: number[]) => {
    reorderMutation.mutate(appIds);
  };

  return {
    currentlyPlaying,
    queue,
    isLoading,
    isStatusLoading,
    statusModal,
    gameSummary,
    handleFinish,
    handleDrop,
    handleCancel,
    handleMoveToBacklog,
    handleConfirm,
    handleCloseStatusModal,
    handleCloseSummary,
    handleRemoveFromQueue,
    handlePickFromQueue,
    handleReorder,
  };
}
