'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchQueuedAppIds } from '@/lib/games/queue';

export function useLibraryMeta(userId: string | null) {
  const [gameCount, setGameCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [queuedAppIds, setQueuedAppIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const addQueuedAppId = useCallback((appId: number) => {
    setQueuedAppIds((prev) => new Set([...prev, appId]));
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const supabase = createClient();
      const [{ count: total }, { count: finishedOrDropped }, queueIds] = await Promise.all([
        supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'game')
          .neq('status', 'hidden'),
        supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'game')
          .in('status', ['finished', 'dropped']),
        fetchQueuedAppIds(),
      ]);

      setGameCount(total || 0);
      setHistoryCount(finishedOrDropped ?? 0);
      setQueuedAppIds(queueIds);
      setLoaded(true);
    }

    load();
  }, [userId]);

  return { gameCount, historyCount, queuedAppIds, addQueuedAppId, loaded };
}
