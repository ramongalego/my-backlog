'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateGameStatus } from '@/lib/games/status';
import { loadCurrentlyPlaying, loadDiaryEntries, type DiaryEntry } from '@/lib/data/loaders';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';

export type { DiaryEntry };

interface DiaryModal {
  appId: number;
  gameName: string;
  headerImage: string | null;
  /** The entry, for the modal's meta row. */
  game: DiaryEntry;
  initialStatus: 'finished';
  initialDate: string | null;
  initialNotes: string | null;
  initialRating: number | null;
}

interface UseDiaryReturn {
  entries: DiaryEntry[];
  loading: boolean;
  hasPlayingGame: boolean;
  detailModal: DiaryModal | null;
  handleOpenDetail: (appId: number) => void;
  handleCloseDetail: () => void;
  handleConfirmDetail: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  /** Saves just the note, keeping the entry's date and rating. */
  handleSaveNotes: (appId: number, notes: string) => void;
}

export function useDiary(): UseDiaryReturn {
  const queryClient = useQueryClient();
  const { games: invalidateGames } = useInvalidateQueries();
  const [detailModal, setDetailModal] = useState<DiaryModal | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const diaryKey = queryKeys.games.diary(userId ?? '');

  const { data: entries = [], isPending } = useQuery({
    queryKey: diaryKey,
    queryFn: () => loadDiaryEntries(createClient(), userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Shares the home page's cache entry. Used to stop the edit modal from
  // silently replacing the current game.
  const { data: playingGame = null } = useQuery({
    queryKey: queryKeys.games.playing(userId ?? ''),
    queryFn: () => loadCurrentlyPlaying(createClient(), userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const diaryMutation = useMutation({
    mutationFn: async (vars: {
      appId: number;
      status: string;
      date: string;
      notes: string;
      rating: number | null;
    }) => {
      await updateGameStatus(vars.appId, vars.status, {
        finishedAt: vars.status === 'finished' ? vars.date : undefined,
        droppedAt: vars.status === 'dropped' ? vars.date : undefined,
        notes: vars.notes,
        rating: vars.rating,
      });
      return vars;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: diaryKey });
      const previous = queryClient.getQueryData<DiaryEntry[]>(diaryKey);

      if (vars.status === 'finished') {
        queryClient.setQueryData(diaryKey, (old: DiaryEntry[] | undefined) => {
          if (!old) return old;
          const updated = old.map((e) =>
            e.app_id === vars.appId
              ? { ...e, finished_at: vars.date || null, notes: vars.notes, rating: vars.rating }
              : e,
          );
          return updated.sort((a, b) => {
            if (!a.finished_at && !b.finished_at) return 0;
            if (!a.finished_at) return 1;
            if (!b.finished_at) return -1;
            return b.finished_at.localeCompare(a.finished_at);
          });
        });
      } else {
        queryClient.setQueryData(diaryKey, (old: DiaryEntry[] | undefined) => {
          if (!old) return old;
          return old.filter((e) => e.app_id !== vars.appId);
        });
      }

      return { previous };
    },
    onError: (err, _vars, context) => {
      console.error(err);
      if (context?.previous) {
        queryClient.setQueryData(diaryKey, context.previous);
      }
      toast.error('Could not save your changes. Please try again.');
    },
    onSettled: () => invalidateGames(),
  });

  const handleOpenDetail = (appId: number) => {
    const entry = entries.find((e) => e.app_id === appId);
    if (!entry) return;

    setDetailModal({
      appId,
      gameName: entry.name,
      headerImage: entry.header_image,
      game: entry,
      initialStatus: 'finished',
      initialDate: entry.finished_at?.slice(0, 10) ?? null,
      initialNotes: entry.notes,
      initialRating: entry.rating,
    });
  };

  const handleCloseDetail = () => setDetailModal(null);

  const handleConfirmDetail = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!detailModal) return;
    diaryMutation.mutate({ appId: detailModal.appId, status, date, notes, rating });
  };

  const handleSaveNotes = (appId: number, notes: string) => {
    const entry = entries.find((e) => e.app_id === appId);
    if (!entry) return;
    diaryMutation.mutate({
      appId,
      status: 'finished',
      date: entry.finished_at?.slice(0, 10) ?? '',
      notes,
      rating: entry.rating,
    });
  };

  return {
    entries,
    loading: !!userId && isPending,
    hasPlayingGame: playingGame !== null,
    detailModal,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
    handleSaveNotes,
  };
}
