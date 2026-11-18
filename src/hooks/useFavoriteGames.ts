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
 * Changes show at once and save one at a time: those made meanwhile go out as
 * one, the latest, so the server always ends on what the page shows.
 */
export function useFavoriteGames(userId: string | null) {
  const queryClient = useQueryClient();
  const key = queryKeys.games.favorites(userId ?? '');
  const query = useQuery(queries.favoriteGames(userId));
  const pickedIds = query.data ?? NONE;

  // What the server has.
  const saved = useRef<number[]>(NONE);
  const sending = useRef(false);
  const waiting = useRef<number[] | null>(null);
  // A refetch landing while a save is out puts the older list in the cache; the
  // next change must build on this one, or it would save the old list back.
  const latest = useRef<number[] | null>(null);

  const cached = () => queryClient.getQueryData<number[]>(key);
  const shown = () => latest.current ?? cached() ?? NONE;

  const send = async (gameIds: number[]) => {
    sending.current = true;
    try {
      await saveFavoriteGames(gameIds);
      saved.current = gameIds;
    } catch (err) {
      // What was waiting was built on the change that failed.
      waiting.current = null;
      latest.current = null;
      queryClient.setQueryData(key, saved.current);
      // The row is back as it was: "Removed … Undo" would no longer be true.
      toast.dismiss(UNDO_TOAST);
      toast.error((err as Error).message);
    } finally {
      sending.current = false;
      const next = waiting.current;
      waiting.current = null;
      if (next && !sameFavorites(next, saved.current)) void send(next);
      else {
        // Over anything a refetch put there meanwhile, then read again to be sure.
        latest.current = null;
        queryClient.setQueryData(key, saved.current);
        void queryClient.invalidateQueries({ queryKey: key });
        // Recent activity says a game became a favorite or stopped being one.
        if (userId) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.games.history(userId) });
        }
      }
    }
  };

  /** The same list again changes nothing. */
  const set = (gameIds: number[]) => {
    // Not loaded: saving would replace the saved picks with a list built on none.
    if (cached() === undefined) return;
    const current = shown();
    if (sameFavorites(current, gameIds)) return;
    // With nothing on its way, what's shown is what the server has.
    if (!sending.current) saved.current = current;
    // A refetch on its way would put the old list back. No revert: it lands a
    // moment later and would do the same.
    void queryClient.cancelQueries({ queryKey: key }, { revert: false });
    queryClient.setQueryData(key, gameIds);
    latest.current = gameIds;
    if (sending.current) waiting.current = gameIds;
    else void send(gameIds);
  };

  return {
    pickedIds,
    /** Until then the row can't be changed. */
    ready: query.data !== undefined,
    /** Say so, rather than show a row with none. */
    failed: query.isError && query.data === undefined,
    retry: () => void query.refetch(),
    /** Ahead of the redraw: two clicks can land before the first is drawn. */
    current: shown,
    set,
    /** For when the picker opens: the toast would sit over its Done button. */
    forgetUndo: () => void toast.dismiss(UNDO_TOAST),
    /** `clean` drops picks the page no longer shows, which the server would refuse. */
    remove: (gameId: number, name: string, clean: (ids: number[]) => number[] = (ids) => ids) => {
      const before = clean(shown());
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
