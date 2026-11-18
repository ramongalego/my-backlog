'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/hooks/useGameMutations';
import { deleteManualGame, playOnSteam, updateHoursPlayed } from '@/lib/client/manual-games';
import { consoleOf } from '@/lib/games/consoles';
import { STEAM_PLATFORM } from '@/lib/games/consoles';
import { UNDO_MS } from '@/lib/undo';
import { useLibraryRefresh } from './useLibraryRefresh';
import { removeGameFromPools, type CarouselPools } from './useCarouselPools';
import type { DiaryEntry, GameItem } from '@/lib/data/loaders';
import type { GameWithImage, QueueItem } from '@/types/games';

// Removed games waiting out their Undo. Each delete refreshes from the server,
// which still has the others, so they're kept hidden through that.
const pendingRemovals = new Set<number>();
// A delete went through (or a game came back) while others were pending:
// refresh once they're done.
let refreshWhenSettled = false;
// A page loaded mid-Undo has these in its list, and the games list isn't
// refetched after an edit, so they're taken off it again.
const deletedIds = new Set<number>();
// The toast pauses in a background tab and dies with the page, so a removal
// would quietly come back: these are sent as the page goes instead.
const unsentDeletes = new Map<number, (keepalive: boolean) => void>();
// Games on their way back to Steam: one request each, however fast it's pressed.
const movingToSteam = new Set<number>();
if (typeof window !== 'undefined') {
  const flush = () => unsentDeletes.forEach((send) => send(true));
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/**
 * Puts one item back after its nearest earlier neighbor still there, else
 * before the nearest later one, so other removals and Undos since are kept.
 */
function reinsert<T>(
  current: T[] | undefined,
  earlier: T[] | undefined,
  idOf: (item: T) => number,
  id: number,
) {
  const index = earlier?.findIndex((e) => idOf(e) === id) ?? -1;
  if (!current || !earlier || index === -1 || current.some((c) => idOf(c) === id)) return current;
  const ids = current.map(idOf);
  const before = earlier
    .slice(0, index)
    .reverse()
    .find((e) => ids.includes(idOf(e)));
  const after = earlier.slice(index + 1).find((e) => ids.includes(idOf(e)));
  const at =
    before !== undefined
      ? ids.indexOf(idOf(before)) + 1
      : after !== undefined
        ? ids.indexOf(idOf(after))
        : current.length;
  return [...current.slice(0, at), earlier[index], ...current.slice(at)];
}

/**
 * For games added by hand and Steam games moved to a console. Edits patch the
 * cached library in place, so one edit downloads nothing again.
 */
export function useManualGameActions(userId: string | null) {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const { refresh: refreshFromSteam } = useLibraryRefresh();
  const keys = {
    list: queryKeys.games.list(userId ?? ''),
    diary: queryKeys.games.diary(userId ?? ''),
    queue: queryKeys.queue.list(userId ?? ''),
    playing: queryKeys.games.playing(userId ?? ''),
  };

  const snapshotCaches = () => ({
    list: queryClient.getQueryData<GameItem[]>(keys.list),
    diary: queryClient.getQueryData<DiaryEntry[]>(keys.diary),
    queue: queryClient.getQueryData<QueueItem[]>(keys.queue),
    playing: queryClient.getQueryData<GameWithImage | null>(keys.playing),
  });
  const restoreCaches = (snapshot: ReturnType<typeof snapshotCaches>) => {
    queryClient.setQueryData(keys.list, snapshot.list);
    queryClient.setQueryData(keys.diary, snapshot.diary);
    queryClient.setQueryData(keys.queue, snapshot.queue);
    queryClient.setQueryData(keys.playing, snapshot.playing);
  };

  const hidePendingRemovals = () => {
    const kept = (id: number) => !pendingRemovals.has(id);
    queryClient.setQueryData<GameItem[]>(keys.list, (old) => old?.filter((g) => kept(g.id)));
    queryClient.setQueryData<DiaryEntry[]>(keys.diary, (old) => old?.filter((g) => kept(g.id)));
    queryClient.setQueryData<QueueItem[]>(keys.queue, (old) => old?.filter((q) => kept(q.game_id)));
    queryClient.setQueryData<GameWithImage | null>(keys.playing, (old) =>
      old && kept(old.id) ? old : null,
    );
    queryClient.setQueriesData<CarouselPools>(
      { queryKey: queryKeys.carousels.all },
      (pools) => pools && [...pendingRemovals].reduce(removeGameFromPools, pools),
    );
  };

  // Refreshing while removals are pending would bring back the games still
  // waiting to be deleted.
  const settleRemovals = () => {
    if (pendingRemovals.size > 0 || !refreshWhenSettled) return;
    refreshWhenSettled = false;
    if (deletedIds.size > 0) {
      queryClient.setQueryData<GameItem[]>(keys.list, (old) =>
        old?.filter((g) => !deletedIds.has(g.id)),
      );
      deletedIds.clear();
    }
    statusChanged();
  };

  // Every cached copy gets the hours, so a summary built from any of them shows
  // them. More hours makes today the last-played date, as on the server.
  const saveHours = async (gameId: number, hours: number) => {
    const minutes = Math.round(hours * 60);
    const now = new Date().toISOString();
    const snapshot = snapshotCaches();
    const updated = <T extends { playtime_forever: number }>(g: T): T => ({
      ...g,
      playtime_forever: minutes,
      ...(minutes > g.playtime_forever && 'last_played_at' in g ? { last_played_at: now } : {}),
    });
    const withHours = <T extends { id: number; playtime_forever: number }>(g: T) =>
      g.id === gameId ? updated(g) : g;
    queryClient.setQueryData<GameItem[]>(keys.list, (old) => old?.map(withHours));
    queryClient.setQueryData<DiaryEntry[]>(keys.diary, (old) => old?.map(withHours));
    queryClient.setQueryData<QueueItem[]>(keys.queue, (old) =>
      old?.map((q) => (q.game_id === gameId ? { ...q, game: updated(q.game) } : q)),
    );
    queryClient.setQueryData<GameWithImage | null>(keys.playing, (old) => old && withHours(old));
    try {
      await updateHoursPlayed(gameId, hours);
    } catch (err) {
      console.error(err);
      restoreCaches(snapshot);
      toast.error("Couldn't save the hours played. Try again.");
    }
    statusChanged();
  };

  /** The delete is sent when the Undo toast goes, so undoing needs no re-adding. */
  const remove = (gameId: number, name: string) => {
    // Remove pressed twice: a second toast would delete the game when it went,
    // even after the first's Undo.
    if (pendingRemovals.has(gameId)) return;
    const snapshot = snapshotCaches();
    pendingRemovals.add(gameId);
    hidePendingRemovals();

    // Just this game, in each list. Carousels wait until no removals are
    // pending, or they'd bring back games still waiting to be deleted.
    const putBack = () => {
      pendingRemovals.delete(gameId);
      refreshWhenSettled = true;
      const idOf = (g: { id: number }) => g.id;
      queryClient.setQueryData<GameItem[]>(keys.list, (old) =>
        reinsert(old, snapshot.list, idOf, gameId),
      );
      queryClient.setQueryData<DiaryEntry[]>(keys.diary, (old) =>
        reinsert(old, snapshot.diary, idOf, gameId),
      );
      queryClient.setQueryData<QueueItem[]>(keys.queue, (old) =>
        reinsert(old, snapshot.queue, (q) => q.game_id, gameId),
      );
      if (snapshot.playing?.id === gameId) queryClient.setQueryData(keys.playing, snapshot.playing);
    };

    let settled = false;
    // Filled in once the toast is up; `send` is defined first, for its callbacks.
    const undoToast: { id?: string | number } = {};
    const send = async (keepalive = false) => {
      if (settled) return;
      settled = true;
      unsentDeletes.delete(gameId);
      // A background tab pauses the toast rather than closing it, and its Undo
      // could no longer undo anything.
      if (keepalive) toast.dismiss(undoToast.id);
      try {
        await deleteManualGame(gameId, keepalive);
        pendingRemovals.delete(gameId);
        deletedIds.add(gameId);
        refreshWhenSettled = true;
      } catch (err) {
        console.error(err);
        putBack();
        toast.error(`Couldn't remove ${name}. It's back in your library.`);
      }
      settleRemovals();
    };
    undoToast.id = toast(`Removed ${name}`, {
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          // Already sent: nothing left to undo.
          if (settled) return;
          settled = true;
          unsentDeletes.delete(gameId);
          putBack();
          settleRemovals();
        },
      },
      onAutoClose: () => send(),
      onDismiss: () => send(),
    });
    unsentDeletes.set(gameId, send);
  };

  /** Moves a Steam game back from a console, then brings back its Steam playtime. */
  const moveToSteam = async (gameId: number, name: string) => {
    if (movingToSteam.has(gameId)) return;
    movingToSteam.add(gameId);
    try {
      await moveBackToSteam(gameId, name);
    } finally {
      movingToSteam.delete(gameId);
    }
  };
  const moveBackToSteam = async (gameId: number, name: string) => {
    const previous = queryClient.getQueryData<GameItem[]>(keys.list);
    queryClient.setQueryData<GameItem[]>(keys.list, (old) =>
      old?.map((g) => (g.id === gameId ? { ...g, platform: STEAM_PLATFORM } : g)),
    );
    try {
      await playOnSteam(gameId);
    } catch (err) {
      console.error(err);
      if (previous) queryClient.setQueryData(keys.list, previous);
      toast.error(`Couldn't move ${name} back to Steam. Try again.`);
      return;
    }
    statusChanged();
    toast.success(`${name} is back on Steam`);
    await refreshFromSteam();
  };

  /** The detail dialog's `manual` prop for a game, or undefined for a Steam game played on Steam. */
  const dialogProps = (game: {
    id: number;
    name: string;
    source?: string;
    platform?: string | null;
  }) => {
    const platform = consoleOf(game);
    if (!platform) return undefined;
    return {
      platform,
      onSaveHours: (hours: number) => saveHours(game.id, hours),
      // Steam games can't be removed (the sync would bring them back), only
      // moved back to Steam.
      ...(game.source === 'steam'
        ? { onMoveToSteam: () => moveToSteam(game.id, game.name) }
        : { onDelete: () => remove(game.id, game.name) }),
    };
  };

  return { saveHours, remove, moveToSteam, dialogProps };
}
