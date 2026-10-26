'use client';

import { useState, useRef } from 'react';
import { useInvalidateQueries } from '@/lib/mutations';
import { chunk } from '@/lib/supabase/paginate';
import { MAX_BULK_APP_IDS, MAX_HLTB_APP_IDS } from '@/lib/validations/common';
import type { Game, SyncProgress } from '@/types/games';

// Games synced at once. Each one spends most of its time waiting on
// HowLongToBeat, so several run side by side; much higher and Steam or HLTB
// start refusing.
const CONCURRENCY = 8;
const MAX_ATTEMPTS = 5;
const MAX_RETRY_WAIT_SECONDS = 15;

// Background HowLongToBeat lookups for games whose time is still missing.
// HLTB allows short bursts, then refuses for up to a minute, so the filler
// waits out each block and stops for this visit after a run of them (the next
// visit picks up where it left off).
const HLTB_MIN_WAIT_MS = 5_000;
const HLTB_MAX_WAIT_MS = 60_000;
const HLTB_MAX_BLOCKS_IN_A_ROW = 6;
// Found times are shown in batches rather than refetching after every game.
const HLTB_REFRESH_EVERY_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clampWait = (ms: number) => Math.min(HLTB_MAX_WAIT_MS, Math.max(HLTB_MIN_WAIT_MS, ms));

// Resolves cache hits in bulk and returns the app_ids that still need an
// individual upstream fetch, plus the ones only missing an HLTB time. A failed
// chunk counts all of its ids as remaining.
async function resolveFromCache(games: Game[]): Promise<{
  resolved: number;
  synced: number;
  remaining: Set<number>;
  hltbPending: number[];
}> {
  let resolved = 0;
  let synced = 0;
  const remaining = new Set<number>();
  const hltbPending: number[] = [];
  for (const ids of chunk(
    games.map((g) => g.app_id),
    MAX_BULK_APP_IDS,
  )) {
    try {
      const res = await fetch('/api/games/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appIds: ids }),
      });
      if (!res.ok) throw new Error(`Bulk sync failed (${res.status})`);
      const data = await res.json();
      resolved += data.resolved;
      synced += data.synced;
      for (const id of data.remaining as number[]) remaining.add(id);
      hltbPending.push(...((data.hltbPending ?? []) as number[]));
    } catch (err) {
      console.error(err);
      for (const id of ids) remaining.add(id);
    }
  }
  return { resolved, synced, remaining, hltbPending };
}

type SyncableGame = Game & {
  metadata_synced?: boolean | null;
  main_story_hours?: number | null;
  release_date?: string | null;
};

/** Whether a single-game sync changed anything the library shows. */
function detailsChanged(
  game: SyncableGame,
  metadata: {
    type?: string | null;
    header_image?: string | null;
    main_story_hours?: number | null;
    release_date?: string | null;
  } | null,
) {
  if (!game.metadata_synced) return true;
  if (!metadata) return false;
  return (
    metadata.main_story_hours !== (game.main_story_hours ?? null) ||
    metadata.header_image !== (game.header_image ?? null) ||
    metadata.release_date !== (game.release_date ?? null) ||
    metadata.type !== (game.type ?? null)
  );
}

export function useGameSync() {
  const { gamesAndQueue: invalidateGameData } = useInvalidateQueries();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0 });
  const [syncingGames, setSyncingGames] = useState<Game[]>([]);
  const syncingRef = useRef(false);
  const hltbQueueRef = useRef<number[]>([]);
  const fillingRef = useRef(false);

  const queueHltb = (appIds: number[]) => {
    const queued = new Set(hltbQueueRef.current);
    hltbQueueRef.current.push(...appIds.filter((id) => !queued.has(id)));
  };

  // Works through the HLTB queue in the background, a few games per request.
  const fillHltbTimes = async () => {
    if (fillingRef.current || hltbQueueRef.current.length === 0) return;
    fillingRef.current = true;
    let blocksInARow = 0;
    let unshown = 0;
    let lastRefresh = Date.now();
    try {
      while (hltbQueueRef.current.length > 0 && blocksInARow < HLTB_MAX_BLOCKS_IN_A_ROW) {
        const batch = hltbQueueRef.current.slice(0, MAX_HLTB_APP_IDS);
        let response: Response;
        try {
          response = await fetch('/api/games/sync/hltb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appIds: batch }),
          });
        } catch {
          blocksInARow++;
          await sleep(HLTB_MIN_WAIT_MS);
          continue;
        }
        if (response.status === 429) {
          blocksInARow++;
          await sleep(clampWait(parseInt(response.headers.get('Retry-After') ?? '10', 10) * 1000));
          continue;
        }
        // Anything else going wrong waits for the next visit.
        if (!response.ok) break;

        const data: {
          results: { appId: number; hours: number | null }[];
          pending: number[];
          retryAfterMs: number;
        } = await response.json();
        const pending = new Set(data.pending);
        const inBatch = new Set(batch);
        hltbQueueRef.current = hltbQueueRef.current.filter(
          (id) => !inBatch.has(id) || pending.has(id),
        );
        unshown += data.results.filter((r) => r.hours !== null).length;
        if (unshown > 0 && Date.now() - lastRefresh >= HLTB_REFRESH_EVERY_MS) {
          invalidateGameData();
          unshown = 0;
          lastRefresh = Date.now();
        }

        if (data.results.length > 0) blocksInARow = 0;
        if (pending.size > 0) {
          blocksInARow++;
          await sleep(clampWait(data.retryAfterMs));
        }
      }
    } finally {
      if (unshown > 0) invalidateGameData();
      fillingRef.current = false;
    }
  };

  const startSync = async (games: SyncableGame[]) => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      // Step 1: cache hits, silently. The progress UI (which replaces the
      // dashboard) only appears when there's real upstream fetching to do.
      const { resolved, synced, remaining, hltbPending } = await resolveFromCache(games);
      queueHltb(hltbPending);
      const remainingGames = games.filter((g) => remaining.has(g.app_id));
      if (remainingGames.length === 0) {
        // Only refetch when the cache actually changed something.
        if (synced > 0) invalidateGameData();
        return;
      }

      // The setup screen is for games that have never been synced. Re-checks
      // of games that already have their details (HLTB retries, monthly
      // refreshes of recent releases) happen quietly in the background.
      const showProgress = remainingGames.some((g) => !g.metadata_synced);

      let completed = resolved;
      if (showProgress) {
        setIsSyncing(true);
        setSyncingGames(games);
        setSyncProgress({ current: completed, total: games.length });
      }

      // Step 2: individually sync only cache misses
      let changed = false;
      const syncOne = async (game: SyncableGame): Promise<void> => {
        let attempts = 0;
        while (attempts < MAX_ATTEMPTS) {
          try {
            const response = await fetch('/api/games/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ appId: game.app_id, name: game.name }),
            });
            // 429: our own rate limit. 503: Steam is throttling us. Either way
            // the game is still unsynced, so wait and try again.
            if (response.status === 429 || response.status === 503) {
              const retryAfter = Math.min(
                parseInt(response.headers.get('Retry-After') ?? '10', 10),
                MAX_RETRY_WAIT_SECONDS,
              );
              await sleep(retryAfter * 1000);
              attempts++;
              continue;
            }
            if (response.ok) {
              const body = await response.json();
              // Synced, but HLTB was refusing: its time is looked up afterwards.
              if (body.hltbPending) queueHltb([game.app_id]);
              if (detailsChanged(game, body.metadata)) changed = true;
            }
          } catch (err) {
            console.error(`Failed to sync ${game.name}:`, err);
          }
          break;
        }
        completed++;
        if (showProgress) setSyncProgress({ current: completed, total: games.length });
      };

      // A rolling queue: each worker takes the next game as soon as it's done,
      // so one slow lookup doesn't hold up the others.
      const queue = [...remainingGames];
      const worker = async () => {
        for (let game = queue.shift(); game; game = queue.shift()) await syncOne(game);
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

      // Carousels, counts and lists were loaded before the metadata existed.
      // Quiet re-checks (HLTB retries, recent releases) usually change
      // nothing, and refetching then would download the library on every visit.
      if (changed) invalidateGameData();
    } finally {
      setIsSyncing(false);
      setSyncingGames([]);
      syncingRef.current = false;
      // Missing times fill in after setup, without holding up the library.
      void fillHltbTimes();
    }
  };

  return { isSyncing, syncProgress, syncingGames, startSync };
}
