import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useManualGameActions } from '@/hooks/useManualGame';
import { deleteManualGame } from '@/lib/games/manual';
import { queryKeys } from '@/lib/query-keys';

const statusChanged = jest.fn();
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('@/lib/mutations', () => ({ useInvalidateQueries: () => ({ statusChanged }) }));
jest.mock('@/hooks/useLibraryRefresh', () => ({
  useLibraryRefresh: () => ({ refresh: jest.fn() }),
}));
jest.mock('@/lib/games/manual', () => ({
  ...jest.requireActual('@/lib/games/manual'),
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
  expect(deleteManualGame).toHaveBeenCalledWith(1);
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
  expect(deleteManualGame).not.toHaveBeenCalledWith(1);

  // Undoing doesn't send the delete; the other still goes through.
  await act(() => toastOptions(0).onAutoClose());
  await act(() => toastOptions(1).onAutoClose());
  expect(deleteManualGame).toHaveBeenCalledTimes(1);
  expect(deleteManualGame).toHaveBeenCalledWith(2);
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
