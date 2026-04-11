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
  const { gamesAndQueue: invalidateGamesAndQueue } = useInvalidateQueries();
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
      await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });
    },
    onMutate: async (appId) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
      queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) =>
        (old ?? []).filter((q) => q.app_id !== appId),
      );
      return { previous };
    },
    onError: (_err, _appId, context) => {
      if (context?.previous) queryClient.setQueryData(queueKey, context.previous);
      toast.error('Failed to remove game from queue');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queueKey }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (appIds: number[]) => {
      await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: appIds }),
      });
    },
    onMutate: async (appIds) => {
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previous = queryClient.getQueryData<QueueItem[]>(queueKey);
      queryClient.setQueryData(queueKey, (old: QueueItem[] | undefined) => {
        if (!old) return old;
        const byId = new Map(old.map((q) => [q.app_id, q]));
        return appIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
      });
      return { previous };
    },
    onError: (_err, _appIds, context) => {
      if (context?.previous) queryClient.setQueryData(queueKey, context.previous);
      toast.error('Failed to reorder queue');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queueKey }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (game: GameWithImage) => {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: game.app_id, status: 'backlog' }),
      });
      await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: game.app_id }),
      });
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

      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: finishedGame.app_id,
          status,
          ...(status === 'finished' ? { finishedAt: date } : {}),
          ...(status === 'dropped' ? { droppedAt: date } : {}),
          notes,
          rating,
        }),
      });

      const supabase = createClient();
      const [{ count: finishedCount }, { count: totalCount }, promotedGame] = await Promise.all([
        supabase
          .from('games')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'game')
          .eq('status', 'finished'),
        supabase
          .from('games')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'game')
          .neq('status', 'hidden'),
        promoteNextFromQueue(userId, supabase),
      ]);

      return {
        finishedGame,
        promoted: promotedGame,
        gamesFinished: finishedCount ?? 0,
        totalGames: totalCount ?? 0,
        status,
        rating,
      };
    },
    onSuccess: ({ finishedGame, promoted, gamesFinished, totalGames, status, rating }) => {
      queryClient.setQueryData(playingKey, promoted);

      if (status === 'finished') {
        setGameSummary({
          gameName: finishedGame.name,
          headerImage: finishedGame.header_image,
          playtimeMinutes: finishedGame.playtime_forever,
          mainStoryHours: finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
          rating,
          gamesFinished,
          totalGames,
          backlogHoursRemoved:
            finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
          nextGame: promoted?.name ?? null,
        });
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

      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, status: 'playing' }),
      });
      await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });

      return fetchCurrentlyPlaying(userId);
    },
    onMutate: async (appId) => {
      const item = queue.find((q) => q.app_id === appId);
      if (!item) return { previousPlaying: undefined, previousQueue: undefined };

      await queryClient.cancelQueries({ queryKey: playingKey });
      await queryClient.cancelQueries({ queryKey: queueKey });
      const previousPlaying = queryClient.getQueryData<GameWithImage | null>(playingKey);
      const previousQueue = queryClient.getQueryData<QueueItem[]>(queueKey);

      queryClient.setQueryData(playingKey, {
        app_id: item.app_id,
        name: item.game.name,
        header_image: item.game.header_image,
        main_story_hours: item.game.main_story_hours ?? 0,
        playtime_forever: item.game.playtime_forever,
        started_at: null,
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

  const isStatusLoading =
    cancelMutation.isPending || confirmMutation.isPending || pickMutation.isPending;

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
    handleConfirm,
    handleCloseStatusModal,
    handleCloseSummary,
    handleRemoveFromQueue,
    handlePickFromQueue,
    handleReorder,
  };
}
