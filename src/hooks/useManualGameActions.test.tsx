import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import { deleteManualGame, playOnSteam } from '@/lib/client/manual-games';
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
  playOnSteam: jest.fn(),
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
  jest.mocked(playOnSteam).mockResolvedValue(undefined);
});

it('takes removed games off at once, and refreshes only after the last delete is sent', async () => {
  const { result, diary, toastOptions } = setup();
  act(() => {
    result.current.remove(1, 'Old game');
    result.current.remove(2, 'Older game');
  });
  expect(diary()).toEqual(['Kept']);

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

  // As if Stats loaded the library meanwhile, from a server that still has the game.
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
  // Kept alive past the page, and sent only once.
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

  await act(async () => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(toast.dismiss).toHaveBeenCalledWith('removed-toast');

  act(() => toastOptions(0).action.onClick());
  expect(diary()).toEqual(['Older game', 'Kept']);
});

it('removes a game once when Remove is pressed twice, so its Undo still brings it back for good', async () => {
  const { result, diary, toastOptions } = setup();
  act(() => {
    result.current.remove(1, 'Old game');
    result.current.remove(1, 'Old game');
  });
  expect(toast).toHaveBeenCalledTimes(1);

  act(() => toastOptions(0).action.onClick());
  await act(() => toastOptions(0).onAutoClose());

  expect(diary()).toEqual(['Old game', 'Older game', 'Kept']);
  expect(deleteManualGame).not.toHaveBeenCalled();
});

it('can remove a game again after its removal was undone', async () => {
  const { result, diary, toastOptions } = setup();
  act(() => result.current.remove(1, 'Old game'));
  act(() => toastOptions(0).action.onClick());

  act(() => result.current.remove(1, 'Old game'));
  expect(diary()).toEqual(['Older game', 'Kept']);
  await act(() => toastOptions(1).onAutoClose());
  expect(deleteManualGame).toHaveBeenCalledWith(1, false);
});

it('moves a game back to Steam once, however many times it is pressed', async () => {
  const { result } = setup();

  await act(async () => {
    void result.current.moveToSteam(3, 'Kept');
    await result.current.moveToSteam(3, 'Kept');
  });

  expect(playOnSteam).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledTimes(1);
});
