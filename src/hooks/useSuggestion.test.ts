import { act, renderHook, waitFor } from '@testing-library/react';
import { useSuggestion } from '@/hooks/useSuggestion';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Each pick the AI is asked for, with the request it came from.
let picks: {
  body: Record<string, unknown>;
  /** `pickId`: the pick as the server kept it (left out when it couldn't). */
  answer: (id: number, pickId?: number | null) => void;
}[] = [];

beforeEach(() => {
  jest.useRealTimers();
  picks = [];
  mockFetch.mockReset().mockImplementation((url: string, init: { body: string }) => {
    if (url !== '/api/suggest') return Promise.resolve({ ok: true, json: async () => ({}) });
    return new Promise((resolve) =>
      picks.push({
        body: JSON.parse(init.body),
        answer: (id, pickId) =>
          resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { game: { id, name: `Game ${id}` }, reasoning: `Because ${id}`, pickId },
            }),
          }),
      }),
    );
  });
});

/** Answers the three questions, pressing the last answer `presses` times. */
function ask(presses = 1, mode?: 'play' | 'queue') {
  const hook = renderHook(() => useSuggestion(mode));
  act(() => hook.result.current.selectMood('relaxed'));
  act(() => hook.result.current.selectEnergy('low'));
  act(() => {
    for (let i = 0; i < presses; i++) hook.result.current.selectTime('short');
  });
  return hook;
}

const rerollCalls = () => mockFetch.mock.calls.filter(([url]) => url === '/api/suggest/reroll');

it('asks for one pick, however many times the last answer is pressed', async () => {
  const { result } = ask(3);
  expect(result.current.step).toBe('loading');

  await act(async () => picks[0].answer(1));

  expect(picks).toHaveLength(1);
  expect(result.current.suggestion?.game.id).toBe(1);
});

it('asks once when Try again is pressed twice', async () => {
  mockFetch.mockImplementationOnce(async () => ({
    ok: false,
    json: async () => ({ error: 'The picker is busy' }),
  }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const { result } = ask();
  await waitFor(() => expect(result.current.error).toBe('The picker is busy'));

  act(() => {
    result.current.retry();
    result.current.retry();
  });

  expect(picks).toHaveLength(1);
});

it('rerolls once when Reroll is pressed twice, counting one reroll', async () => {
  const { result } = ask();
  await act(async () => picks[0].answer(1));

  await act(async () => {
    void result.current.reroll();
    void result.current.reroll();
  });

  expect(picks).toHaveLength(2);
  expect(rerollCalls()).toHaveLength(1);
  expect(picks[1].body.excludeGameIds).toEqual([1]);
});

it.each([
  ['to play, unless told otherwise', undefined, 'play'],
  ['to play', 'play', 'play'],
  ['for the queue', 'queue', 'queue'],
] as const)('says what the pick is for: %s', async (_, mode, sent) => {
  ask(1, mode);
  expect(picks[0].body.mode).toBe(sent);
});

it('passes the kept pick on with its reroll, so it is kept as rerolled', async () => {
  const { result } = ask();
  await act(async () => picks[0].answer(1, 41));
  expect(result.current.suggestion?.pickId).toBe(41);

  await act(async () => {
    void result.current.reroll();
  });

  expect(rerollCalls()).toHaveLength(1);
  expect(JSON.parse(rerollCalls()[0][1].body)).toEqual({ gameId: 1, pickId: 41 });
  // The pick after it is still for the same thing.
  expect(picks[1].body.mode).toBe('play');
});

it.each([
  ['null', null],
  ['left out', undefined],
])("rerolls without a pick id when the pick wasn't kept (%s)", async (_, pickId) => {
  const { result } = ask();
  await act(async () => picks[0].answer(1, pickId));

  await act(async () => {
    void result.current.reroll();
  });

  expect(JSON.parse(rerollCalls()[0][1].body)).toEqual({ gameId: 1 });
});

describe('a pick that arrives after the picker closed', () => {
  const outcomeCalls = () =>
    mockFetch.mock.calls
      .filter(([url, init]) => url === '/api/suggest/picks' && init.method === 'PATCH')
      .map(([, init]) => JSON.parse(init.body));

  it('is kept as never seen', async () => {
    const { unmount } = ask();
    unmount();
    await act(async () => picks[0].answer(1, 41));

    expect(outcomeCalls()).toEqual([{ pickId: 41, outcome: 'unseen' }]);
  });

  it("sends nothing when it wasn't kept", async () => {
    const { unmount } = ask();
    unmount();
    await act(async () => picks[0].answer(1, null));

    expect(outcomeCalls()).toEqual([]);
  });

  it('is left alone when the picker is still open: it has been seen', async () => {
    const { result } = ask();
    await act(async () => picks[0].answer(1, 41));

    expect(result.current.suggestion?.game.id).toBe(1);
    expect(outcomeCalls()).toEqual([]);
  });
});

it('keeps rerolling past the fifth: it sends the latest reasons only, as many as the server takes', async () => {
  jest.useFakeTimers();
  const { result } = ask();
  await act(async () => picks[0].answer(1));

  // Seven rerolls in a sitting, each after its cooldown.
  for (let i = 1; i <= 7; i++) {
    await act(async () => {
      void result.current.reroll();
    });
    await act(async () => picks[i].answer(i + 1));
    await act(async () => {
      jest.advanceTimersByTime(16000);
    });
  }

  const last = picks[7].body as { previousReasonings: string[]; excludeGameIds: number[] };
  expect(last.previousReasonings).toEqual([
    'Because 3',
    'Because 4',
    'Because 5',
    'Because 6',
    'Because 7',
  ]);
  // Every game already shown stays excluded.
  expect(last.excludeGameIds).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(result.current.suggestion?.game.id).toBe(8);
});
