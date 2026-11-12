import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useQueue, useRemoveFromQueue } from '@/hooks/useQueue';
import { removeFromQueue } from '@/lib/client/queue';
import { loadQueue } from '@/lib/data/loaders';
import type { QueueItem } from '@/types/games';

jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/client/queue', () => ({
  addToQueue: jest.fn(),
  removeFromQueue: jest.fn(),
  reorderQueue: jest.fn(),
}));
jest.mock('@/lib/data/loaders', () => ({
  ...jest.requireActual('@/lib/data/loaders'),
  loadQueue: jest.fn(),
}));

const item = (game_id: number): QueueItem => ({
  id: game_id,
  game_id,
  position: game_id,
  game: {
    app_id: game_id,
    name: `Game ${game_id}`,
    header_image: null,
    playtime_forever: 0,
    main_story_hours: 10,
    steam_review_score: null,
  },
});

// What the server holds: a removal takes its game off when it's saved.
let server: QueueItem[] = [];
// Each removal's request, to be answered by the test.
let saves: { gameId: number; finish: () => void }[] = [];

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => ({ queue: useQueue('u').queue, remove: useRemoveFromQueue('u') }), {
    wrapper,
  });
}
const shown = (result: { current: { queue: QueueItem[] } }) =>
  result.current.queue.map((q) => q.game_id);

beforeEach(() => {
  server = [item(1), item(2), item(3), item(4)];
  saves = [];
  jest
    .mocked(loadQueue)
    .mockReset()
    .mockImplementation(async () => [...server]);
  jest
    .mocked(removeFromQueue)
    .mockReset()
    .mockImplementation(
      (gameId) =>
        new Promise<void>((resolve) => {
          saves.push({
            gameId,
            finish: () => {
              server = server.filter((q) => q.game_id !== gameId);
              resolve();
            },
          });
        }),
    );
});

it('keeps games removed in quick succession off the list while they are saved one by one', async () => {
  const { result } = setup();
  await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));
  const seen: number[][] = [];
  const record = () => seen.push(shown(result));

  // Three removals before the first is saved: all three leave at once.
  act(() => {
    result.current.remove(2);
    result.current.remove(3);
    result.current.remove(4);
  });
  await waitFor(() => expect(shown(result)).toEqual([1]));
  record();

  // They're saved in turn. After each, the list on screen still has only
  // game 1: reading the queue back before the last is saved would bring the
  // ones still waiting back for a moment.
  for (const gameId of [2, 3, 4]) {
    await waitFor(() => expect(saves.some((s) => s.gameId === gameId)).toBe(true));
    await act(async () => {
      saves.find((s) => s.gameId === gameId)!.finish();
      await new Promise((r) => setTimeout(r, 20));
    });
    record();
  }

  expect(seen).toEqual([[1], [1], [1], [1]]);
  // Read once on load, and once more after the last removal.
  await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2));
  expect(shown(result)).toEqual([1]);
});

it('still reads the queue back after a single removal', async () => {
  const { result } = setup();
  await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));

  act(() => result.current.remove(3));
  await waitFor(() => expect(saves).toHaveLength(1));
  await act(async () => saves[0].finish());

  await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2));
  expect(shown(result)).toEqual([1, 2, 4]);
});
