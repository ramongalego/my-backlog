import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useSetGameStatus } from '@/lib/mutations';
import { updateGameStatus } from '@/lib/games/status';
import { queryKeys } from '@/lib/query-keys';
import type { GameItem } from '@/lib/data/loaders';

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/lib/games/status', () => ({ updateGameStatus: jest.fn() }));

const game = {
  id: 1,
  name: 'Celeste',
  status: 'backlog',
  rating: null,
  notes: null,
  finished_at: null,
} as GameItem;
const edit = { gameId: 1, status: 'finished', date: '2026-10-28', notes: '', rating: 9 };

function setup(options?: Parameters<typeof useSetGameStatus>[1]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.games.list('u'), [game]);
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  const cancel = jest.spyOn(queryClient, 'cancelQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useSetGameStatus('u', options), { wrapper });
  const list = () => queryClient.getQueryData<GameItem[]>(queryKeys.games.list('u'));
  return { ...hook, list, invalidate, cancel };
}

beforeEach(() => jest.clearAllMocks());

it('shows the change in the games list at once, then refreshes what it touches', async () => {
  let answer!: () => void;
  jest.mocked(updateGameStatus).mockReturnValue(new Promise<void>((r) => (answer = r)));
  const { result, list, invalidate, cancel } = setup();

  act(() => result.current.mutate(edit));

  await waitFor(() => expect(list()?.[0]).toMatchObject({ status: 'finished', rating: 9 }));
  // A list fetch in flight can't land on top of the change.
  expect(cancel).toHaveBeenCalledWith({ queryKey: queryKeys.games.list('u') });
  expect(updateGameStatus).toHaveBeenCalledWith(1, 'finished', {
    finishedAt: '2026-10-28',
    droppedAt: undefined,
    notes: '',
    rating: 9,
  });

  await act(async () => answer());
  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.carousels.all }),
  );
});

it('puts everything back and says so if the save fails', async () => {
  jest.mocked(updateGameStatus).mockRejectedValue(new Error('500'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const rollback = jest.fn();
  const { result, list } = setup({ apply: () => 'diary before', rollback });

  act(() => result.current.mutate(edit));

  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(list()?.[0].status).toBe('backlog');
  expect(rollback).toHaveBeenCalledWith('diary before');
});

it('lets the caller refresh less, for a change only some queries show', async () => {
  jest.mocked(updateGameStatus).mockResolvedValue();
  const settle = jest.fn();
  const { result, invalidate } = setup({ settle });

  act(() => result.current.mutate(edit));

  await waitFor(() => expect(settle).toHaveBeenCalledWith(edit));
  expect(invalidate).not.toHaveBeenCalled();
});
