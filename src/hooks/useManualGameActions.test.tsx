import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import { deleteManualGame } from '@/lib/client/manual-games';
import { queryKeys } from '@/lib/query-keys';

const statusChanged = jest.fn();
jest.mock('sonner', () => ({
  toast: Object.assign(
    jest.fn(() => 'removed-toast'),
    { error: jest.fn(), success: jest.fn(), dismiss: jest.fn() },
  ),
}));
jest.mock('@/hooks/useGameMutations', () => ({ useInvalidateQueries: () => ({ statusChanged }) }));
jest.mock('@/hooks/useLibraryRefresh', () => ({
  useLibraryRefresh: () => ({ refresh: jest.fn() }),
}));
jest.mock('@/lib/client/manual-games', () => ({
  ...jest.requireActual('@/lib/client/manual-games'),
  deleteManualGame: jest.fn(),
}));

const diaryKey = queryKeys.games.diary('u');
const entry = (id: number, name: string) => ({ id, name });

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(diaryKey, [
    entry(1, 'Old game'),
    entry(2, 'Older game'),
    entry(3, 'Kept'),
  ]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useManualGameActions('u'), { wrapper });
  const diary = () =>
    (queryClient.getQueryData<{ name: string }[]>(diaryKey) ?? []).map((e) => e.name);
  // The toast for each removal, in order: its auto-close sends the delete.
  const toastOptions = (i: number) =>
    jest.mocked(toast).mock.calls[i][1] as unknown as {
      onAutoClose: () => Promise<void>;
      action: { onClick: () => void };
    };
  return { result, queryClient, diary, toastOptions };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(deleteManualGame).mockResolvedValue(undefined);
});

it('takes removed games off at once, and refreshes only after the last delete is sent', async () => {
  const { result, diary, toastOptions } = setup();
  act(() => {
    result.current.remove(1, 'Old game');
    result.current.remove(2, 'Older game');
  });
  expect(diary()).toEqual(['Kept']);

  // The first delete goes through while the second is still on offer: a
  // refresh now would bring the second one back from the server.
  await act(() => toastOptions(0).onAutoClose());
  expect(deleteManualGame).toHaveBeenCalledWith(1, false);
  expect(statusChanged).not.toHaveBeenCalled();

  await act(() => toastOptions(1).onAutoClose());
  expect(statusChanged).toHaveBeenCalledTimes(1);
});

it("undoing one removal brings back that game only, not another that's pending", async () => {
  const { result, diary, toastOptions } = setup();
  act(() => {
    result.current.remove(1, 'Old game');
    result.current.remove(2, 'Older game');
  });

  act(() => toastOptions(0).action.onClick());
  expect(diary()).toEqual(['Old game', 'Kept']);
  expect(deleteManualGame).not.toHaveBeenCalledWith(1, false);

  // Undoing doesn't send the delete; the other still goes through.
  await act(() => toastOptions(0).onAutoClose());
  await act(() => toastOptions(1).onAutoClose());
  expect(deleteManualGame).toHaveBeenCalledTimes(1);
  expect(deleteManualGame).toHaveBeenCalledWith(2, false);
  expect(statusChanged).toHaveBeenCalledTimes(1);
});

it('undoing both brings both back, each where it was', () => {
  const { result, diary, toastOptions } = setup();
  act(() => {
    result.current.remove(1, 'Old game');
    result.current.remove(2, 'Older game');
  });

  act(() => toastOptions(0).action.onClick());
  act(() => toastOptions(1).action.onClick());
  expect(diary()).toEqual(['Old game', 'Older game', 'Kept']);
  expect(deleteManualGame).not.toHaveBeenCalled();
  // Nothing was deleted, but the carousels are rebuilt to bring the games back.
  expect(statusChanged).toHaveBeenCalledTimes(1);
});

it('takes a deleted game off a games list loaded while its Undo was on offer', async () => {
  const { result, queryClient, toastOptions } = setup();
  const listKey = queryKeys.games.list('u');
  act(() => result.current.remove(1, 'Old game'));

  // Opening Stats meanwhile loads the library from the server, which still
  // has the game; the list isn't refetched after the delete.
  act(() => {
    queryClient.setQueryData(listKey, [entry(1, 'Old game'), entry(3, 'Kept')]);
  });
  await act(() => toastOptions(0).onAutoClose());
  expect(queryClient.getQueryData<{ name: string }[]>(listKey)?.map((g) => g.name)).toEqual([
    'Kept',
  ]);
});

it('sends a pending removal as the page goes, rather than losing it with the toast', async () => {
  const { result, toastOptions } = setup();
  act(() => result.current.remove(1, 'Old game'));
  expect(deleteManualGame).not.toHaveBeenCalled();

  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  // Kept alive past the page, and only once: the toast closing later sends nothing.
  expect(deleteManualGame).toHaveBeenCalledWith(1, true);
  await act(() => toastOptions(0).onAutoClose());
  expect(deleteManualGame).toHaveBeenCalledTimes(1);
});

it("doesn't send a removal that was undone when the page goes", async () => {
  const { result, toastOptions } = setup();
  act(() => result.current.remove(1, 'Old game'));
  act(() => toastOptions(0).action.onClick());

  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(deleteManualGame).not.toHaveBeenCalled();
});

it("takes the toast down once the delete has gone, so Undo can't pretend to restore the game", async () => {
  const { result, diary, toastOptions } = setup();
  act(() => result.current.remove(1, 'Old game'));

  // Switching tabs sends the delete; the toast only pauses while hidden, so it
  // would still be there, Undo and all, on coming back.
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(toast.dismiss).toHaveBeenCalledWith('removed-toast');

  // And a click on an Undo that was still on screen changes nothing: the game
  // is gone on the server, so it mustn't reappear here.
  act(() => toastOptions(0).action.onClick());
  expect(diary()).toEqual(['Older game', 'Kept']);
});
