'use client';

import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queries } from '@/lib/data/queries';
import { queryKeys } from '@/lib/query-keys';
import { saveFavoriteGames } from '@/lib/client/favorites';
import { sameFavorites } from '@/lib/account/favorites';
import { UNDO_MS } from '@/lib/undo';

const NONE: number[] = [];
/** One Undo toast for the favorites: a newer removal replaces the last. */
const UNDO_TOAST = 'favorites-undo';

/**
 * The games a player picked as favorites (ids, in order) and changing them.
 * A change shows at once and saves in the background, as the queue's do. One
 * save is on its way at a time: changes made meanwhile wait and go out as one,
 * the latest, so the server always ends on what the page shows. A failed save
 * says so and puts back what the server has.
 */
export function useFavoriteGames(userId: string | null) {
  const queryClient = useQueryClient();
  const key = queryKeys.games.favorites(userId ?? '');
  const { data: pickedIds = NONE } = useQuery(queries.favoriteGames(userId));

  // What the server has, the save on its way, and the change waiting for it.
  const saved = useRef<number[]>(NONE);
  const sending = useRef(false);
  const waiting = useRef<number[] | null>(null);

  const shown = () => queryClient.getQueryData<number[]>(key) ?? NONE;

  const send = async (gameIds: number[]) => {
    sending.current = true;
    try {
      await saveFavoriteGames(gameIds);
      saved.current = gameIds;
    } catch (err) {
      // What was waiting was built on the change that failed.
      waiting.current = null;
      queryClient.setQueryData(key, saved.current);
      toast.error((err as Error).message);
    } finally {
      sending.current = false;
      const next = waiting.current;
      waiting.current = null;
      if (next && !sameFavorites(next, saved.current)) void send(next);
      else void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  /** Shows the new favorites and saves them. The same list again changes nothing. */
  const set = (gameIds: number[]) => {
    const current = shown();
    if (sameFavorites(current, gameIds)) return;
    // With nothing on its way, what's shown is what the server has.
    if (!sending.current) saved.current = current;
    // A refetch on its way would put the old list back over this one. Canceled
    // without reverting: a revert lands a moment later, and would itself put
    // the old list back over the one set on the next line.
    void queryClient.cancelQueries({ queryKey: key }, { revert: false });
    queryClient.setQueryData(key, gameIds);
    if (sending.current) waiting.current = gameIds;
    else void send(gameIds);
  };

  return {
    pickedIds,
    /**
     * The picks as they are this instant, ahead of the next redraw: what a
     * change has to build on, since two clicks can land before the page has
     * drawn the first.
     */
    current: shown,
    set,
    /**
     * Puts the Undo toast away. For when the picker opens: the toast would sit
     * over its Done button, and there the game can just be picked again.
     */
    forgetUndo: () => void toast.dismiss(UNDO_TOAST),
    /** Takes a game off the favorites, with an Undo that puts the row back as it was. */
    remove: (gameId: number, name: string) => {
      const before = shown();
      if (!before.includes(gameId)) return;
      set(before.filter((id) => id !== gameId));
      // One Undo per removal, however many times it's pressed.
      let undone = false;
      toast(`Removed ${name} from your favorites`, {
        id: UNDO_TOAST,
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            if (undone) return;
            undone = true;
            set(before);
          },
        },
      });
    },
  };
}
