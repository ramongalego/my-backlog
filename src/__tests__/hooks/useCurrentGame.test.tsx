import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCurrentGame } from '@/hooks/useCurrentGame';

const pick = jest.fn();
jest.mock('@/hooks/useNowPlaying', () => ({
  useNowPlaying: () => ({ pick, isStatusLoading: false, queuedGameIds: new Set([7, 8]) }),
}));
jest.mock('@/lib/mutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
  useSetGameStatus: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
}));

// The filters Random's game queries were built with.
const filters: string[] = [];
const hollowKnight = { id: 3, name: 'Hollow Knight', header_image: null };
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const builder = {
        select: (_cols: string, options?: { head: boolean }) => {
          if (table === 'games') filters.push('select');
          return Object.assign(builder, { head: !!options?.head });
        },
        eq: () => builder,
        not: (col: string, op: string, value: unknown) => {
          filters.push(`not ${col} ${op} ${value}`);
          return builder;
        },
        or: (value: string) => {
          filters.push(`or ${value}`);
          return builder;
        },
        lte: () => builder,
        contains: () => builder,
        order: () => builder,
        range: () => builder,
        head: false,
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            table === 'playing_queue'
              ? { data: [{ game_id: 7 }, { game_id: 8 }], error: null }
              : builder.head
                ? { count: 1, error: null }
                : { data: [hollowKnight], error: null },
          ),
      };
      return builder;
    },
  }),
}));

beforeEach(() => {
  filters.length = 0;
  pick.mockReset();
  window.scrollTo = jest.fn();
});

it("picks from the backlog only: never a queued game or the one you're playing", async () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCurrentGame('u'), { wrapper });

  await act(() => result.current.handleRandomPick());

  expect(filters).toContain('not id in (7,8)');
  expect(filters).toContain('or status.is.null,status.eq.backlog');
  expect(pick).toHaveBeenCalledWith(hollowKnight);
});
