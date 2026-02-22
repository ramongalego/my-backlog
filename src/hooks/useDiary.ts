'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

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

export function useDiary(): UseDiaryReturn {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<DiaryModal | null>(null);

  useEffect(() => {
    async function loadEntries() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('games')
        .select('app_id, name, header_image, rating, notes, finished_at')
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false, nullsFirst: false });

      setEntries(data || []);
      setLoading(false);
    }

    loadEntries();
  }, []);

  const handleOpenDetail = useCallback(
    (appId: number) => {
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
    },
    [entries],
  );

  const handleCloseDetail = useCallback(() => setDetailModal(null), []);

  const handleConfirmDetail = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
      if (!detailModal) return;
      const { appId } = detailModal;
      setDetailModal(null);

      try {
        await fetch('/api/games/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId,
            status,
            ...(status === 'finished' ? { finishedAt: date } : {}),
            ...(status === 'dropped' ? { droppedAt: date } : {}),
            ...(status === 'playing' ? { started_at: new Date().toISOString() } : {}),
            notes,
            rating,
          }),
        });

        if (status === 'finished') {
          // Update the entry then re-sort to match DB ordering (newest first, nulls last)
          setEntries((prev) => {
            const updated = prev.map((e) =>
              e.app_id === appId ? { ...e, finished_at: date || null, notes, rating } : e,
            );
            return updated.sort((a, b) => {
              if (!a.finished_at && !b.finished_at) return 0;
              if (!a.finished_at) return 1;
              if (!b.finished_at) return -1;
              return b.finished_at.localeCompare(a.finished_at);
            });
          });
        } else {
          // Remove from diary — no longer finished
          setEntries((prev) => prev.filter((e) => e.app_id !== appId));
        }
      } catch (err) {
        console.error('Failed to update game:', err);
      }
    },
    [detailModal],
  );

  return {
    entries,
    loading,
    detailModal,
    handleOpenDetail,
    handleCloseDetail,
    handleConfirmDetail,
  };
}
