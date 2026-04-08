'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';

export interface DiaryEntry {
  app_id: number;
  name: string;
  header_image: string | null;
  rating: number | null;
  notes: string | null;
  finished_at: string | null;
}

interface DiaryModal {
  appId: number;
  gameName: string;
  headerImage: string | null;
  initialStatus: 'finished';
  initialDate: string | null;
  initialNotes: string | null;
  initialRating: number | null;
}

interface UseDiaryReturn {
  entries: DiaryEntry[];
  loading: boolean;
  detailModal: DiaryModal | null;
  handleOpenDetail: (appId: number) => void;
  handleCloseDetail: () => void;
  handleConfirmDetail: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
}

async function fetchDiaryEntries(): Promise<DiaryEntry[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from('games')
    .select('app_id, name, header_image, rating, notes, finished_at')
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false, nullsFirst: false });

  return (data || []) as DiaryEntry[];
}

export function useDiary(): UseDiaryReturn {
  const queryClient = useQueryClient();
  const { games: invalidateGames } = useInvalidateQueries();
  const [detailModal, setDetailModal] = useState<DiaryModal | null>(null);

  const { data: entries = [], isPending } = useQuery({
    queryKey: queryKeys.games.diary(),
    queryFn: fetchDiaryEntries,
    staleTime: 5 * 60 * 1000,
  });

  const diaryMutation = useMutation({
    mutationFn: async (vars: {
      appId: number;
      status: string;
      date: string;
      notes: string;
      rating: number | null;
    }) => {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: vars.appId,
          status: vars.status,
          ...(vars.status === 'finished' ? { finishedAt: vars.date } : {}),
          ...(vars.status === 'dropped' ? { droppedAt: vars.date } : {}),
          ...(vars.status === 'playing' ? { started_at: new Date().toISOString() } : {}),
          notes: vars.notes,
          rating: vars.rating,
        }),
      });
      return vars;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.games.diary() });
      const previous = queryClient.getQueryData<DiaryEntry[]>(queryKeys.games.diary());

      if (vars.status === 'finished') {
        queryClient.setQueryData(queryKeys.games.diary(), (old: DiaryEntry[] | undefined) => {
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
        queryClient.setQueryData(queryKeys.games.diary(), (old: DiaryEntry[] | undefined) => {
          if (!old) return old;
          return old.filter((e) => e.app_id !== vars.appId);
        });
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.games.diary(), context.previous);
      }
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

  return {
    entries,
    loading: isPending,
    detailModal,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
  };
}
