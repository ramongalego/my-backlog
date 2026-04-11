'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { celebrateGameFinished } from '@/lib/confetti';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';
import { useLibraryRefresh } from './useLibraryRefresh';
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
  handleCancel: () => Promise<void>;
  handleConfirm: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  handleCloseStatusModal: () => void;
  handleCloseSummary: () => void;
  handleRemoveFromQueue: (appId: number) => Promise<void>;
  handlePickFromQueue: (appId: number) => Promise<void>;
  handleReorder: (appIds: number[]) => Promise<void>;
}

async function fetchPlayingGame(): Promise<GameWithImage | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('games')
    .select(
      'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat',
    )
    .eq('user_id', user.id)
    .eq('status', 'playing')
    .single();

  return data ?? null;
}

async function fetchQueue(): Promise<QueueItem[]> {
  const res = await fetch('/api/queue');
  if (!res.ok) return [];
  const data = await res.json();
  return data.queue ?? [];
}

export function usePlayingQueuePage(): UsePlayingQueuePageReturn {
  const queryClient = useQueryClient();
  const { gamesAndQueue: invalidateGamesAndQueue } = useInvalidateQueries();
  const { refreshIfStale } = useLibraryRefresh();
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);

  const { data: currentlyPlaying = null, isPending: isPlayingPending } = useQuery({
    queryKey: queryKeys.games.playing(),
    queryFn: fetchPlayingGame,
    staleTime: 30 * 1000,
  });

  const { data: queue = [], isPending: isQueuePending } = useQuery({
    queryKey: queryKeys.queue.list(),
    queryFn: fetchQueue,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = isPlayingPending || isQueuePending;

  useEffect(() => {
    if (isLoading) return;
    refreshIfStale();
  }, [isLoading, refreshIfStale]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async (appId: number) => {
      await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });
    },
    onMutate: async (appId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.queue.list() });
      const previous = queryClient.getQueryData<QueueItem[]>(queryKeys.queue.list());
      queryClient.setQueryData(queryKeys.queue.list(), (old: QueueItem[] | undefined) =>
        (old ?? []).filter((q) => q.app_id !== appId),
      );
      return { previous };
    },
    onError: (_err, _appId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.queue.list(), context.previous);
      toast.error('Failed to remove game from queue');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.queue.list() }),
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
      await queryClient.cancelQueries({ queryKey: queryKeys.queue.list() });
      const previous = queryClient.getQueryData<QueueItem[]>(queryKeys.queue.list());
      queryClient.setQueryData(queryKeys.queue.list(), (old: QueueItem[] | undefined) => {
        if (!old) return old;
        const byId = new Map(old.map((q) => [q.app_id, q]));
        return appIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
      });
      return { previous };
    },
    onError: (_err, _appIds, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.queue.list(), context.previous);
      toast.error('Failed to reorder queue');
    },
  });

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

  const handleCancel = async () => {
    if (!currentlyPlaying) return;
    const game = currentlyPlaying;

    setIsStatusLoading(true);
    queryClient.setQueryData(queryKeys.games.playing(), null);
    queryClient.setQueryData(queryKeys.queue.list(), (old: QueueItem[] | undefined) => [
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

    try {
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
      invalidateGamesAndQueue();
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to move game to queue:', err);
      toast.error('Failed to move game to queue');
      queryClient.setQueryData(queryKeys.games.playing(), game);
      queryClient.setQueryData(queryKeys.queue.list(), (old: QueueItem[] | undefined) =>
        (old ?? []).filter((q) => q.app_id !== game.app_id),
      );
    } finally {
      setIsStatusLoading(false);
    }
  };

  const handleConfirm = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!currentlyPlaying) return;
    const finishedGame = currentlyPlaying;
    setStatusModal(null);
    setIsStatusLoading(true);
    try {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let promoted: GameWithImage | null = null;
      let gamesFinished = 0;
      let totalGames = 0;

      if (user) {
        const [{ count: finishedCount }, { count: totalCount }, promotedGame] = await Promise.all([
          supabase
            .from('games')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('type', 'game')
            .eq('status', 'finished'),
          supabase
            .from('games')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('type', 'game')
            .neq('status', 'hidden'),
          promoteNextFromQueue(user.id, supabase),
        ]);
        promoted = promotedGame;
        gamesFinished = finishedCount ?? 0;
        totalGames = totalCount ?? 0;
      }

      queryClient.setQueryData(queryKeys.games.playing(), promoted);

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

      invalidateGamesAndQueue();
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Failed to ${status} game:`, err);
      toast.error(`Failed to ${status} game`);
    }
    setIsStatusLoading(false);
  };

  const handleRemoveFromQueue = async (appId: number) => {
    removeMutation.mutate(appId);
  };

  const handlePickFromQueue = async (appId: number) => {
    const item = queue.find((q) => q.app_id === appId);
    if (!item) return;

    setIsStatusLoading(true);
    queryClient.setQueryData(queryKeys.games.playing(), {
      app_id: item.app_id,
      name: item.game.name,
      header_image: item.game.header_image,
      main_story_hours: item.game.main_story_hours ?? 0,
      playtime_forever: item.game.playtime_forever,
      started_at: null,
    });
    queryClient.setQueryData(queryKeys.queue.list(), (old: QueueItem[] | undefined) =>
      (old ?? []).filter((q) => q.app_id !== appId),
    );

    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, status: 'playing' }),
      });
      await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: game } = await supabase
          .from('games')
          .select(
            'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat',
          )
          .eq('user_id', user.id)
          .eq('app_id', appId)
          .single();
        if (game) queryClient.setQueryData(queryKeys.games.playing(), game);
      }
      invalidateGamesAndQueue();
    } catch (err) {
      Sentry.captureException(err);
      console.error('Failed to pick game from queue:', err);
      toast.error('Failed to start playing');
      queryClient.setQueryData(queryKeys.games.playing(), null);
      queryClient.setQueryData(queryKeys.queue.list(), (old: QueueItem[] | undefined) => [
        ...(old ?? []),
        item,
      ]);
    } finally {
      setIsStatusLoading(false);
    }
  };

  const handleReorder = async (appIds: number[]) => {
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
