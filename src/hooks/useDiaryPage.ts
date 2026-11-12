'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaryEntry } from '@/lib/data/loaders';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { useSwitchGame } from './useSwitchGame';
import { useInvalidateQueries, useSetGameStatus, type StatusEdit } from '@/hooks/useGameMutations';
import type { GameStatus } from '@/lib/games/status';
import { ALL_YEARS, diaryTimeline } from '@/lib/diary/timeline';
import { useUrlState } from './useUrlState';

export type { DiaryEntry };

interface DiaryModal {
  /** The entry the dialog is about. */
  game: DiaryEntry;
  initialStatus: 'finished';
  initialDate: string | null;
  initialNotes: string | null;
  initialRating: number | null;
}

interface UseDiaryReturn {
  entries: DiaryEntry[];
  loading: boolean;
  /** The first load failed: show that, not an empty page. */
  loadError: boolean;
  retry: () => void;
  hasPlayingGame: boolean;
  detailModal: DiaryModal | null;
  /** Plays the open game instead of the one being played (a replay). */
  handlePlayInstead: () => Promise<void>;
  /** The game being played, which that would pause. */
  playingName: string | null;
  handleOpenDetail: (gameId: number) => void;
  handleCloseDetail: () => void;
  handleConfirmDetail: (
    status: GameStatus,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  /** Saves just the note, keeping the entry's date and rating. */
  handleSaveNotes: (gameId: number, notes: string) => void;
  /** The year shown (kept in the URL), or ALL_YEARS. */
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  /** The entries as the page lays them out, for that year. */
  timeline: ReturnType<typeof diaryTimeline<DiaryEntry>>;
}

export function useDiaryPage(): UseDiaryReturn {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const [detailModal, setDetailModal] = useState<DiaryModal | null>(null);
  const [selectedYear, setSelectedYear] = useUrlState<string>('year', ALL_YEARS);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const diaryKey = queryKeys.games.diary(userId ?? '');

  const {
    data: entries = [],
    isPending,
    isLoadingError,
    refetch,
  } = useQuery(queries.diary(userId));

  // Shares the home page's cache entry. Used to stop the edit modal from
  // silently replacing the current game.
  const { data: playingGame = null } = useQuery(queries.playing(userId));

  const diaryMutation = useSetGameStatus<
    StatusEdit & {
      /** Only the note changed: nothing outside the diary shows it. */
      notesOnly?: boolean;
    },
    DiaryEntry[] | undefined
  >(userId, {
    // The diary is its own query: change it there too.
    apply: async (vars) => {
      await queryClient.cancelQueries({ queryKey: diaryKey });
      const previous = queryClient.getQueryData<DiaryEntry[]>(diaryKey);

      if (vars.status === 'finished') {
        queryClient.setQueryData(diaryKey, (old: DiaryEntry[] | undefined) => {
          if (!old) return old;
          const updated = old.map((e) =>
            e.id === vars.gameId
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
          return old.filter((e) => e.id !== vars.gameId);
        });
      }

      return previous;
    },
    rollback: (previous) => {
      if (previous) queryClient.setQueryData(diaryKey, previous);
    },
    settle: (vars) => {
      if (!vars.notesOnly) return statusChanged();
      // A note doesn't affect carousels, the queue, counts or the playing game.
      queryClient.invalidateQueries({ queryKey: diaryKey });
    },
  });

  const handleOpenDetail = (gameId: number) => {
    const entry = entries.find((e) => e.id === gameId);
    if (!entry) return;

    setDetailModal({
      game: entry,
      initialStatus: 'finished',
      initialDate: entry.finished_at?.slice(0, 10) ?? null,
      initialNotes: entry.notes,
      initialRating: entry.rating,
    });
  };

  const handleCloseDetail = () => setDetailModal(null);

  // The dialog's Playing while another game is playing: replay this one
  // instead. Undo puts it back as finished, with its date, rating and notes.
  const switchGame = useSwitchGame(userId);
  const handlePlayInstead = async () => {
    if (!detailModal) return;
    await switchGame.switchTo(detailModal.game, {
      status: detailModal.initialStatus,
      date: detailModal.initialDate ?? '',
      notes: detailModal.initialNotes,
      rating: detailModal.initialRating,
    });
  };

  const handleConfirmDetail = async (
    status: GameStatus,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!detailModal) return;
    diaryMutation.mutate({ gameId: detailModal.game.id, status, date, notes, rating });
  };

  const handleSaveNotes = (gameId: number, notes: string) => {
    const entry = entries.find((e) => e.id === gameId);
    if (!entry) return;
    diaryMutation.mutate({
      gameId,
      status: 'finished',
      date: entry.finished_at?.slice(0, 10) ?? '',
      notes,
      rating: entry.rating,
      notesOnly: true,
    });
  };

  return {
    entries,
    loading: !!userId && isPending,
    loadError: isLoadingError,
    retry: () => void refetch(),
    hasPlayingGame: playingGame !== null,
    detailModal,
    handlePlayInstead,
    playingName: switchGame.playing?.name ?? null,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
    handleSaveNotes,
    selectedYear,
    setSelectedYear,
    timeline: diaryTimeline(entries, selectedYear),
  };
}
