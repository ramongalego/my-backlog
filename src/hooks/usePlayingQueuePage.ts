'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';
import { celebrateGameFinished } from '@/lib/confetti';
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

const ONE_HOUR_MS = 60 * 60 * 1000;

export function usePlayingQueuePage(): UsePlayingQueuePageReturn {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<GameWithImage | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);

  const fetchQueue = useCallback(async () => {
    const res = await fetch('/api/queue');
    if (res.ok) {
      const data = await res.json();
      setQueue(data.queue ?? []);
    }
  }, []);

  const runRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/steam/refresh', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      localStorage.setItem('playtime_refresh_at', Date.now().toString());
      if (data.newGames > 0) {
        window.location.reload();
        return;
      }
      // No new games — just re-fetch the now playing game to update playtime
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: playingGame } = await supabase
          .from('games')
          .select('app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score')
          .eq('user_id', user.id)
          .eq('status', 'playing')
          .single();
        if (playingGame) setCurrentlyPlaying(playingGame);
      }
    } catch (err) {
      console.error('Failed to refresh library:', err);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const [{ data: playingGame }, queueRes] = await Promise.all([
        supabase
          .from('games')
          .select('app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score')
          .eq('user_id', user.id)
          .eq('status', 'playing')
          .single(),
        fetch('/api/queue'),
      ]);

      if (playingGame) {
        setCurrentlyPlaying(playingGame);
      }

      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueue(data.queue ?? []);
      }

      setIsLoading(false);

      // Auto-refresh playtime if it's been more than 1 hour (same logic as home page)
      const lastRefresh = localStorage.getItem('playtime_refresh_at');
      if (!lastRefresh || Date.now() - parseInt(lastRefresh) > ONE_HOUR_MS) {
        runRefresh();
      }
    }

    load();
  }, [runRefresh]);

  const handleFinish = useCallback(() => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'finished' });
  }, [currentlyPlaying]);

  const handleDrop = useCallback(() => {
    if (!currentlyPlaying) return;
    setStatusModal({ action: 'dropped' });
  }, [currentlyPlaying]);

  const handleCloseStatusModal = useCallback(() => setStatusModal(null), []);
  const handleCloseSummary = useCallback(() => setGameSummary(null), []);

  const handleCancel = useCallback(async () => {
    if (!currentlyPlaying) return;
    const game = currentlyPlaying;

    // Optimistic update: immediately remove from now playing and append to queue
    setCurrentlyPlaying(null);
    setQueue((prev) => [
      ...prev,
      {
        id: -1,
        app_id: game.app_id,
        position: prev.length,
        game: {
          name: game.name,
          header_image: game.header_image,
          playtime_forever: game.playtime_forever,
          main_story_hours: game.main_story_hours,
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
      await fetchQueue();
    } catch (err) {
      console.error('Failed to move game to queue:', err);
      // Revert
      setCurrentlyPlaying(game);
      setQueue((prev) => prev.filter((q) => q.app_id !== game.app_id));
    }
  }, [currentlyPlaying, fetchQueue]);

  const handleConfirm = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
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

        if (status === 'finished') {
          setGameSummary({
            gameName: finishedGame.name,
            headerImage: finishedGame.header_image,
            startedAt: finishedGame.started_at ?? null,
            finishedAt: date,
            playtimeMinutes: finishedGame.playtime_forever,
            mainStoryHours:
              finishedGame.main_story_hours > 0 ? finishedGame.main_story_hours : null,
            rating,
          });
          celebrateGameFinished();
        }

        if (user) {
          const promoted = await promoteNextFromQueue(user.id, supabase);
          setCurrentlyPlaying(promoted);
        } else {
          setCurrentlyPlaying(null);
        }

        await fetchQueue();
      } catch (err) {
        console.error(`Failed to ${status} game:`, err);
      }
      setIsStatusLoading(false);
    },
    [currentlyPlaying, fetchQueue],
  );

  const handleRemoveFromQueue = useCallback(async (appId: number) => {
    try {
      await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });
      setQueue((prev) => prev.filter((q) => q.app_id !== appId));
    } catch (err) {
      console.error('Failed to remove from queue:', err);
    }
  }, []);

  const handleReorder = useCallback(
    async (appIds: number[]) => {
      const previous = queue;
      setQueue((prev) => {
        const byId = new Map(prev.map((q) => [q.app_id, q]));
        return appIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
      });
      try {
        await fetch('/api/queue', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: appIds }),
        });
      } catch (err) {
        console.error('Failed to reorder queue:', err);
        setQueue(previous);
      }
    },
    [queue],
  );

  const handlePickFromQueue = useCallback(
    async (appId: number) => {
      const item = queue.find((q) => q.app_id === appId);
      if (!item) return;

      // Optimistic update: immediately show as now playing
      setCurrentlyPlaying({
        app_id: item.app_id,
        name: item.game.name,
        header_image: item.game.header_image,
        main_story_hours: item.game.main_story_hours ?? 0,
        playtime_forever: item.game.playtime_forever,
        started_at: null,
      });
      setQueue((prev) => prev.filter((q) => q.app_id !== appId));

      try {
        await fetch('/api/games/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, status: 'playing' }),
        });
        await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });

        // Fetch real game data to get accurate started_at
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: game } = await supabase
            .from('games')
            .select('app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score')
            .eq('user_id', user.id)
            .eq('app_id', appId)
            .single();
          if (game) setCurrentlyPlaying(game);
        }
      } catch (err) {
        console.error('Failed to pick game from queue:', err);
        // Revert
        setCurrentlyPlaying(null);
        setQueue((prev) => [...prev, item]);
      }
    },
    [queue],
  );

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
