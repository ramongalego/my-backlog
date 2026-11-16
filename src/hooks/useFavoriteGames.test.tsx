import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useFavoriteGames } from '@/hooks/useFavoriteGames';
import { saveFavoriteGames } from '@/lib/client/favorites';
import { loadFavoriteGames } from '@/lib/data/loaders';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), dismiss: jest.fn() }),
}));
jest.mock('@/lib/client/favorites', () => ({ saveFavoriteGames: jest.fn() }));
jest.mock('@/lib/data/loaders', () => ({
  ...jest.requireActual('@/lib/data/loaders'),
  loadFavoriteGames: jest.fn(),
}));

const key = queryKeys.games.favorites('user-1');

/** Saves that stay on their way until the test finishes or fails them. */
function heldSaves() {
  const held: { ids: number[]; finish: () => void; fail: (message: string) => void }[] = [];
  jest.mocked(saveFavoriteGames).mockImplementation(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        held.push({ ids, finish: resolve, fail: (message) => reject(new Error(message)) });
      }),
  );
  return held;
}

/** The cache of the hook last set up, for a test to put a refetch's result in. */
let favoritesCache: () => QueryClient;

function setup(saved: number[] = [3, 1]) {
  // What the server has, as a refetch would read it.
  let onServer = saved;
  jest.mocked(loadFavoriteGames).mockImplementation(async () => onServer);
  const client = new QueryClient();
  client.setQueryData(key, saved);
  favoritesCache = () => client;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useFavoriteGames('user-1'), { wrapper });
  return {
    favorites: () => hook.result.current,
    setOnServer: (ids: number[]) => (onServer = ids),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(saveFavoriteGames).mockResolvedValue(undefined);
});

it('gives the saved picks, in order', () => {
  expect(setup().favorites().pickedIds).toEqual([3, 1]);
});

it('has none while there is no user, without asking', () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useFavoriteGames(null), { wrapper });
  expect(result.current.pickedIds).toEqual([]);
  expect(loadFavoriteGames).not.toHaveBeenCalled();
});

it('shows a change at once and saves it', async () => {
  const held = heldSaves();
  const { favorites, setOnServer } = setup();

  act(() => favorites().set([5, 3]));
  // Shown before the server has answered, and readable this instant.
  expect(favorites().current()).toEqual([5, 3]);
  await waitFor(() => expect(favorites().pickedIds).toEqual([5, 3]));
  expect(saveFavoriteGames).toHaveBeenCalledWith([5, 3]);

  setOnServer([5, 3]);
  await act(async () => held[0].finish());
  expect(favorites().pickedIds).toEqual([5, 3]);
});

it('sends nothing for the list it already shows', () => {
  const { favorites } = setup();
  act(() => favorites().set([3, 1]));
  expect(saveFavoriteGames).not.toHaveBeenCalled();
});

it('sends one request for the same change pressed several times at once', () => {
  heldSaves();
  const { favorites } = setup();
  act(() => {
    favorites().set([5]);
    favorites().set([5]);
    favorites().set([5]);
  });
  expect(saveFavoriteGames).toHaveBeenCalledTimes(1);
});

it('keeps one save on its way: changes made meanwhile go out as one, the latest', async () => {
  const held = heldSaves();
  const { favorites } = setup([]);

  act(() => {
    favorites().set([1]);
    favorites().set([1, 2]);
    favorites().set([1, 2, 3]);
  });
  // Only the first has gone; the page already shows the last.
  expect(held.map((save) => save.ids)).toEqual([[1]]);
  expect(favorites().current()).toEqual([1, 2, 3]);

  await act(async () => held[0].finish());
  expect(held.map((save) => save.ids)).toEqual([[1], [1, 2, 3]]);
  await act(async () => held[1].finish());
  expect(saveFavoriteGames).toHaveBeenCalledTimes(2);
});

it('sends nothing more when the changes made meanwhile end where the save already is', async () => {
  const held = heldSaves();
  const { favorites } = setup([]);

  act(() => {
    favorites().set([1]);
    favorites().set([1, 2]);
    favorites().set([1]);
  });
  await act(async () => held[0].finish());
  expect(saveFavoriteGames).toHaveBeenCalledTimes(1);
});

it('says why a save failed and puts back what the server has', async () => {
  const held = heldSaves();
  const { favorites } = setup([3, 1]);

  act(() => {
    favorites().set([5]);
    // Built on the change that's about to fail: it goes with it.
    favorites().set([5, 6]);
  });
  await act(async () => held[0].fail("Couldn't save your favorites. Please try again."));

  expect(toast.error).toHaveBeenCalledWith("Couldn't save your favorites. Please try again.");
  expect(favorites().current()).toEqual([3, 1]);
  await waitFor(() => expect(favorites().pickedIds).toEqual([3, 1]));
  expect(saveFavoriteGames).toHaveBeenCalledTimes(1);

  // It can be tried again.
  act(() => favorites().set([5]));
  expect(saveFavoriteGames).toHaveBeenCalledTimes(2);
});

describe('removing a favorite', () => {
  const undo = () => {
    const [, options] = jest.mocked(toast).mock.calls[0] as unknown as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    return options.action;
  };

  it('takes it off, and offers an Undo that puts the row back as it was', () => {
    const { favorites } = setup([3, 1, 4]);
    act(() => favorites().remove(1, 'Hades'));

    expect(favorites().current()).toEqual([3, 4]);
    expect(saveFavoriteGames).toHaveBeenCalledWith([3, 4]);
    expect(toast).toHaveBeenCalledWith(
      'Removed Hades from your favorites',
      expect.objectContaining({ id: 'favorites-undo' }),
    );
    expect(undo().label).toBe('Undo');

    act(() => undo().onClick());
    // In its place, not at the end.
    expect(favorites().current()).toEqual([3, 1, 4]);
  });

  it('removes once however fast the X is pressed, and undoes once', async () => {
    const { favorites } = setup([3, 1, 4]);
    act(() => {
      favorites().remove(1, 'Hades');
      favorites().remove(1, 'Hades');
    });
    expect(saveFavoriteGames).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);

    await act(async () => {
      undo().onClick();
      undo().onClick();
    });
    expect(favorites().current()).toEqual([3, 1, 4]);
    // The removal, then the one undo.
    expect(saveFavoriteGames).toHaveBeenCalledTimes(2);
  });

  it('puts its Undo away when asked, as the page does when the picker opens', () => {
    const { favorites } = setup([3, 1, 4]);
    act(() => favorites().remove(1, 'Hades'));
    act(() => favorites().forgetUndo());
    expect(toast.dismiss).toHaveBeenCalledWith('favorites-undo');
    // The removal itself stands.
    expect(favorites().current()).toEqual([3, 4]);
  });

  it("does nothing for a game that isn't a favorite", () => {
    const { favorites } = setup([3]);
    act(() => favorites().remove(9, 'Celeste'));
    expect(saveFavoriteGames).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('before the picks have loaded', () => {
  /** A hook whose favorites never arrive: the read fails. */
  function unloaded() {
    jest.mocked(loadFavoriteGames).mockRejectedValue(new Error('offline'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useFavoriteGames('user-1'), { wrapper });
  }

  it('saves nothing: a pick now would replace the saved favorites with a list built on none', async () => {
    const hook = unloaded();
    expect(hook.result.current.ready).toBe(false);

    act(() => hook.result.current.set([5]));
    act(() => hook.result.current.remove(5, 'Hades'));

    expect(saveFavoriteGames).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("says they couldn't be loaded, and can try again", async () => {
    const hook = unloaded();
    await waitFor(() => expect(hook.result.current.failed).toBe(true));
    expect(hook.result.current.ready).toBe(false);

    jest.mocked(loadFavoriteGames).mockResolvedValue([3, 1]);
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.failed).toBe(false);
    expect(hook.result.current.pickedIds).toEqual([3, 1]);
  });

  it('is ready, and not failed, once they are known', () => {
    const { favorites } = setup([3, 1]);
    expect(favorites().ready).toBe(true);
    expect(favorites().failed).toBe(false);
  });
});

it('builds the next change on the list it showed, even if a refetch put the old one back meanwhile', async () => {
  const held = heldSaves();
  const { favorites } = setup([3, 1, 4]);

  act(() => favorites().remove(1, 'Hades'));
  expect(held[0].ids).toEqual([3, 4]);
  // A refetch that read the rows before the save committed lands now.
  act(() => {
    // The same cache the hook reads.
    favoritesCache().setQueryData(key, [3, 1, 4]);
  });

  // The next change still starts from [3, 4], not from the stale [3, 1, 4].
  expect(favorites().current()).toEqual([3, 4]);
  act(() => favorites().set([...favorites().current(), 9]));
  await act(async () => held[0].finish());
  expect(held[1].ids).toEqual([3, 4, 9]);
  await act(async () => held[1].finish());
});

it('removes from the picks the page shows, leaving out one it no longer lists', () => {
  const { favorites } = setup([3, 1, 99]);
  // 99 was hidden or deleted since: the page shows only 3 and 1.
  act(() => favorites().remove(1, 'Hades', (ids) => ids.filter((id) => id !== 99)));
  expect(saveFavoriteGames).toHaveBeenCalledWith([3]);
});
