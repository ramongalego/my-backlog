'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiaryEntry } from '@/lib/data/loaders';
import { queries } from '@/lib/data/queries';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { useGameDialog } from './useGameDialog';
import type { GameDialogProps } from '@/components/games/GameDetailModal';
import { useInvalidateQueries, useSetGameStatus, type StatusEdit } from '@/hooks/useGameMutations';
import type { GameStatus } from '@/lib/games/status';
import { ALL_YEARS, diaryTimeline } from '@/lib/diary/timeline';
import { useUrlState } from './useUrlState';

export type { DiaryEntry };

interface UseDiaryReturn {
  entries: DiaryEntry[];
  loading: boolean;
  /** The first load failed: show that, not an empty page. */
  loadError: boolean;
  retry: () => void;
  /** The detail dialog's props for the open entry, or null when it's closed. */
  gameDialog: GameDialogProps | null;
  handleOpenDetail: (gameId: number) => void;
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
  const [opened, setOpened] = useState<DiaryEntry | null>(null);
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

  // The entry as it was when its dialog opened.
  const handleOpenDetail = (gameId: number) => {
    const entry = entries.find((e) => e.id === gameId);
    if (entry) setOpened(entry);
  };

  const dialogFor = useGameDialog(userId);
  const openedDate = opened?.finished_at?.slice(0, 10) ?? null;
  const gameDialog: GameDialogProps | null = opened && {
    game: opened,
    initialStatus: 'finished',
    initialDate: openedDate,
    initialNotes: opened.notes,
    initialRating: opened.rating,
    onClose: () => setOpened(null),
    onConfirm: (status: GameStatus, date: string, notes: string, rating: number | null) =>
      diaryMutation.mutate({ gameId: opened.id, status, date, notes, rating }),
    // Playing it again while another game is being played: Undo puts it back
    // as finished, with its date, rating and notes.
    ...dialogFor(opened, {
      status: 'finished',
      from: {
        status: 'finished',
        date: openedDate ?? '',
        notes: opened.notes,
        rating: opened.rating,
      },
    }),
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
    gameDialog,
    handleOpenDetail,
    handleSaveNotes,
    selectedYear,
    setSelectedYear,
    timeline: diaryTimeline(entries, selectedYear),
  };
}
