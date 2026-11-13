import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useBulkStatus } from '@/hooks/useBulkStatus';
import { BulkMoveError, restoreGameStatuses, updateGameStatuses } from '@/lib/client/game-status';
import type { GameRestore } from '@/lib/games/bulk-status';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@/lib/client/game-status', () => ({
  ...jest.requireActual('@/lib/client/game-status'),
  updateGameStatuses: jest.fn(),
  restoreGameStatuses: jest.fn(),
}));
// (BulkMoveError stays the real class, through requireActual above.)

const game = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Game ${id}`,
  source: 'steam',
  platform: null,
  status: 'backlog',
  finished_at: null as string | null,
  dropped_at: null,
  notes: null as string | null,
  rating: null as number | null,
  last_played_at: null,
  ...overrides,
});
// A backlog game that still carries the date and rating from when it was finished.
const hades = game(1, { finished_at: '2026-04-08T00:00:00+00:00', rating: 8 });
const celeste = game(2, {
  status: 'finished',
  finished_at: '2026-10-25T00:00:00+00:00',
  notes: 'Loved it',
  rating: 9,
});
const portal = game(3, { status: 'hidden' });

/** What the server says the moved games had. */
const previous: GameRestore[] = [
  {
    id: 1,
    status: 'backlog',
    started_at: '2026-02-28T17:43:40.217+00:00',
    finished_at: '2026-04-08T00:00:00+00:00',
    dropped_at: null,
    notes: null,
    rating: 8,
    last_played_at: null,
  },
  {
    id: 2,
    status: 'finished',
    started_at: null,
    finished_at: '2026-10-25T00:00:00+00:00',
    dropped_at: null,
    notes: 'Loved it',
    rating: 9,
    last_played_at: null,
  },
];

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.games.list('u'), [hades, celeste, portal]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const list = () => queryClient.getQueryData<(typeof hades)[]>(queryKeys.games.list('u'))!;
  return { ...renderHook(() => useBulkStatus('u'), { wrapper }), list };
}

const undoFromToast = () =>
  (jest.mocked(toast).mock.calls[0][1] as unknown as { action: { onClick: () => void } }).action;

beforeEach(() => {
  jest.mocked(updateGameStatuses).mockReset().mockResolvedValue(previous);
  jest.mocked(restoreGameStatuses).mockReset().mockResolvedValue(undefined);
  jest.mocked(toast).mockClear();
  jest.mocked(toast.error).mockClear();
});

it('moves the games on the page at once and saves them in one request', async () => {
  let saved!: (previous: GameRestore[]) => void;
  jest.mocked(updateGameStatuses).mockReturnValue(new Promise((resolve) => (saved = resolve)));
  const { result, list } = setup();

  act(() => result.current.move([hades, celeste, portal] as never, 'hidden'));

  // Before the server answers. Portal was hidden already, so it isn't sent.
  await waitFor(() => expect(list().map((g) => g.status)).toEqual(['hidden', 'hidden', 'hidden']));
  expect(updateGameStatuses).toHaveBeenCalledTimes(1);
  expect(updateGameStatuses).toHaveBeenCalledWith([
    { gameId: 1, status: 'hidden' },
    { gameId: 2, status: 'hidden' },
  ]);

  await act(async () => saved(previous));
  expect(toast).toHaveBeenCalledWith(
    'Moved 2 games to Hidden',
    expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
  );
});

it('undoes a move by sending back exactly what the server said the games had', async () => {
  const { result, list } = setup();
  act(() => result.current.move([hades, celeste] as never, 'hidden'));
  await waitFor(() => expect(toast).toHaveBeenCalled());
  // Hidden cleared the dates and ratings on the page.
  expect(list()[0]).toMatchObject({ status: 'hidden', finished_at: null, rating: null });

  act(() => undoFromToast().onClick());

  await waitFor(() => expect(restoreGameStatuses).toHaveBeenCalledWith(previous));
  // The page has them back too, leftovers included, and nothing else is sent.
  expect(list()[0]).toMatchObject({
    status: 'backlog',
    finished_at: '2026-04-08T00:00:00+00:00',
    rating: 8,
  });
  expect(list()[1]).toMatchObject({ status: 'finished', notes: 'Loved it', rating: 9 });
  expect(list()[2].status).toBe('hidden');
  expect(updateGameStatuses).toHaveBeenCalledTimes(1);
  // The undo itself isn't offered an undo.
  expect(toast).toHaveBeenCalledTimes(1);
});

describe('telling the page when a move is done', () => {
  it('waits for the save, so Select mode closes as the toast appears', async () => {
    let saved!: (previous: GameRestore[]) => void;
    jest.mocked(updateGameStatuses).mockReturnValue(new Promise((resolve) => (saved = resolve)));
    const onMoved = jest.fn();
    const { result } = setup();

    act(() => result.current.move([hades, celeste] as never, 'hidden', onMoved));
    await waitFor(() => expect(result.current.pending).toBe(true));
    expect(onMoved).not.toHaveBeenCalled();

    await act(async () => saved(previous));
    expect(onMoved).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("doesn't when the save fails: the selection is still there to try again", async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(updateGameStatuses).mockRejectedValue(new Error('down'));
    const onMoved = jest.fn();
    const { result } = setup();

    act(() => result.current.move([hades] as never, 'hidden', onMoved));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onMoved).not.toHaveBeenCalled();
  });

  it('does straight away when every game was already there', () => {
    const onMoved = jest.fn();
    const { result } = setup();
    act(() => result.current.move([portal] as never, 'hidden', onMoved));
    expect(onMoved).toHaveBeenCalledTimes(1);
  });
});

describe('clicks that come too fast', () => {
  it('sends a move once, however many times Move is pressed before the page catches up', async () => {
    const { result } = setup();

    act(() => {
      result.current.move([hades] as never, 'hidden');
      result.current.move([hades] as never, 'hidden');
      result.current.move([hades] as never, 'hidden');
    });

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(updateGameStatuses).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('takes the next move once the first is saved, or has failed', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(updateGameStatuses).mockRejectedValueOnce(new Error('down'));
    const { result } = setup();

    act(() => result.current.move([hades] as never, 'hidden'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    act(() => result.current.move([hades] as never, 'hidden'));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    act(() => result.current.move([celeste] as never, 'hidden'));

    await waitFor(() => expect(updateGameStatuses).toHaveBeenCalledTimes(3));
  });

  it('undoes once, however many times Undo is pressed', async () => {
    const { result } = setup();
    act(() => result.current.move([hades, celeste] as never, 'hidden'));
    await waitFor(() => expect(toast).toHaveBeenCalled());

    act(() => {
      undoFromToast().onClick();
      undoFromToast().onClick();
    });

    await waitFor(() => expect(restoreGameStatuses).toHaveBeenCalled());
    expect(restoreGameStatuses).toHaveBeenCalledTimes(1);
  });
});

it("replaces the last move's toast with the new one, so only the latest move can be undone", async () => {
  const { result } = setup();
  act(() => result.current.move([hades] as never, 'hidden'));
  await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
  act(() => result.current.move([celeste] as never, 'backlog'));
  await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));

  const ids = jest.mocked(toast).mock.calls.map(([, options]) => (options as { id?: string }).id);
  expect(ids[0]).toBeDefined();
  expect(ids[1]).toBe(ids[0]);
});

describe('saying what went wrong', () => {
  const failWith = async (err: Error) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(updateGameStatuses).mockRejectedValue(err);
    const { result } = setup();
    act(() => result.current.move([hades] as never, 'hidden'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    return jest.mocked(toast.error).mock.calls[0][0];
  };

  it('asks to wait when moves came too fast', async () => {
    expect(await failWith(new BulkMoveError('Too many requests', 429))).toBe(
      'Too many moves in a row. Try again in a moment.',
    );
  });

  it("passes on the server's reason for a move it won't make", async () => {
    const reason = "The game you're playing can't be changed with others.";
    expect(await failWith(new BulkMoveError(reason, 409))).toBe(reason);
  });

  it('keeps to the plain message for anything else', async () => {
    expect(await failWith(new BulkMoveError('Invalid input', 400))).toBe(
      "Couldn't move those games. Please try again.",
    );
  });
});

it('says "1 game" for one', async () => {
  const { result } = setup();
  act(() => result.current.move([hades] as never, 'wont_play'));
  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith("Moved 1 game to Won't Play", expect.anything()),
  );
});

it('puts the page back and says so when the save fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(updateGameStatuses).mockRejectedValue(new Error('down'));
  const { result, list } = setup();

  act(() => result.current.move([hades, celeste] as never, 'hidden'));

  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(list()).toEqual([hades, celeste, portal]);
  expect(toast).not.toHaveBeenCalled();
});

it('leaves the games moved and says so when an Undo fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(restoreGameStatuses).mockRejectedValue(new Error('down'));
  const { result, list } = setup();
  act(() => result.current.move([hades, celeste] as never, 'hidden'));
  await waitFor(() => expect(toast).toHaveBeenCalled());

  act(() => undoFromToast().onClick());

  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(list().map((g) => g.status)).toEqual(['hidden', 'hidden', 'hidden']);
});

it('sends nothing when every game is already there', () => {
  const { result } = setup();
  act(() => result.current.move([portal] as never, 'hidden'));
  expect(updateGameStatuses).not.toHaveBeenCalled();
});
