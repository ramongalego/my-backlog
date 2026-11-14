import { act, renderHook, waitFor } from '@testing-library/react';
import { useSuggestion } from '@/hooks/useSuggestion';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Each pick the AI is asked for, with the request it came from.
let picks: { body: Record<string, unknown>; answer: (id: number) => void }[] = [];

beforeEach(() => {
  jest.useRealTimers();
  picks = [];
  mockFetch.mockReset().mockImplementation((url: string, init: { body: string }) => {
    if (url !== '/api/suggest') return Promise.resolve({ ok: true, json: async () => ({}) });
    return new Promise((resolve) =>
      picks.push({
        body: JSON.parse(init.body),
        answer: (id) =>
          resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: { game: { id, name: `Game ${id}` }, reasoning: `Because ${id}` },
            }),
          }),
      }),
    );
  });
});

/** Answers the three questions, pressing the last answer `presses` times. */
function ask(presses = 1) {
  const hook = renderHook(() => useSuggestion());
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
