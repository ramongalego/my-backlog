'use client';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries } from '@/lib/mutations';
import { consoleOf, deleteManualGame, playOnSteam, updateHoursPlayed } from '@/lib/games/manual';
import { STEAM_PLATFORM } from '@/lib/games/consoles';
import { useLibraryRefresh } from './useLibraryRefresh';
import { removeGameFromPools, type CarouselPools } from './useCarouselPools';
import type { DiaryEntry, GameItem } from '@/lib/data/loaders';
import type { GameWithImage, QueueItem } from '@/types/games';

// How long Undo is offered before a removal is sent.
const UNDO_MS = 6000;

/**
 * Editing and removing games added by hand, and Steam games moved to a
 * console, from any page's detail dialog. Edits change the cached library in
 * place, like status changes do, so nothing is downloaded again for one edit.
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

  // Every cached copy of the game gets the new hours, so a summary or card
  // built from any of them (finishing it from Now Playing) shows them.
  const saveHours = async (gameId: number, hours: number) => {
    const minutes = Math.round(hours * 60);
    const snapshot = snapshotCaches();
    const withHours = <T extends { id: number; playtime_forever: number }>(g: T) =>
      g.id === gameId ? { ...g, playtime_forever: minutes } : g;
    queryClient.setQueryData<GameItem[]>(keys.list, (old) => old?.map(withHours));
    queryClient.setQueryData<DiaryEntry[]>(keys.diary, (old) => old?.map(withHours));
    queryClient.setQueryData<QueueItem[]>(keys.queue, (old) =>
      old?.map((q) =>
        q.game_id === gameId ? { ...q, game: { ...q.game, playtime_forever: minutes } } : q,
      ),
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

  /**
   * Takes the game off every list straight away and offers Undo; the delete
   * itself is sent when the toast goes, so undoing needs no re-adding.
   */
  const remove = (gameId: number, name: string) => {
    const snapshot = snapshotCaches();
    queryClient.setQueryData<GameItem[]>(keys.list, (old) => old?.filter((g) => g.id !== gameId));
    queryClient.setQueryData<DiaryEntry[]>(keys.diary, (old) =>
      old?.filter((g) => g.id !== gameId),
    );
    queryClient.setQueryData<QueueItem[]>(keys.queue, (old) =>
      old?.filter((q) => q.game_id !== gameId),
    );
    if (snapshot.playing?.id === gameId) queryClient.setQueryData(keys.playing, null);
    queryClient.setQueriesData<CarouselPools>(
      { queryKey: queryKeys.carousels.all },
      (pools) => pools && removeGameFromPools(pools, gameId),
    );

    let settled = false;
    const send = async () => {
      if (settled) return;
      settled = true;
      try {
        await deleteManualGame(gameId);
      } catch (err) {
        console.error(err);
        // Put it back everywhere, the games list included (statusChanged
        // doesn't refetch that).
        restoreCaches(snapshot);
        queryClient.invalidateQueries({ queryKey: queryKeys.carousels.all });
        toast.error(`Couldn't remove ${name}. It's back in your library.`);
      }
      statusChanged();
    };
    toast(`Removed ${name}`, {
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          settled = true;
          restoreCaches(snapshot);
          queryClient.invalidateQueries({ queryKey: queryKeys.carousels.all });
        },
      },
      onAutoClose: send,
      onDismiss: send,
    });
  };

  /** Moves a Steam game back from a console, then brings back its Steam playtime. */
  const moveToSteam = async (gameId: number, name: string) => {
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
