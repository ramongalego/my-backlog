import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getGameDetails, SteamUnavailableError } from '@/lib/steam/store-api';
import { useGameSync } from '@/hooks/useGameSync';

const json = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  ({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: new Headers(init.headers),
    json: async () => body,
  }) as Response;

describe('getGameDetails', () => {
  it('returns what Steam says about an app, including "no such app"', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ 7: { success: false } })) as typeof fetch;
    await expect(getGameDetails(7)).resolves.toEqual({ success: false });
  });

  it.each([
    ['a rate limit', () => Promise.resolve(json(null, { status: 429 }))],
    ['an outage', () => Promise.resolve(json(null, { status: 502 }))],
    ['a throttled empty answer', () => Promise.resolve(json(null))],
    ['a network failure', () => Promise.reject(new Error('timeout'))],
  ])('treats %s as "try again later", not as a missing game', async (_, answer) => {
    global.fetch = jest.fn(answer) as typeof fetch;
    await expect(getGameDetails(7)).rejects.toBeInstanceOf(SteamUnavailableError);
  });
});

describe('useGameSync', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const games = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ app_id: i + 1, name: `Game ${i + 1}` }));

  /** Nothing in the cache; each game's sync answers via `answer`. */
  function mockSync(answer: (appId: number, attempt: number) => Promise<Response>) {
    const attempts = new Map<number, number>();
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith('/bulk')) {
        return json({ resolved: 0, synced: 0, remaining: body.appIds });
      }
      const attempt = (attempts.get(body.appId) ?? 0) + 1;
      attempts.set(body.appId, attempt);
      return answer(body.appId, attempt);
    }) as typeof fetch;
    return attempts;
  }

  it('keeps 8 games in flight, without waiting for the slowest of a group', async () => {
    let inFlight = 0;
    let peak = 0;
    const order: number[] = [];
    let releaseSlow!: () => void;
    const slow = new Promise<void>((resolve) => (releaseSlow = resolve));

    mockSync(async (appId) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      // Game 1 is stuck until everything else has finished.
      if (appId === 1) await slow;
      else await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      order.push(appId);
      if (order.length === 19) releaseSlow();
      return json({ success: true });
    });

    const { result } = renderHook(() => useGameSync(), { wrapper });
    await act(() => result.current.startSync(games(20)));

    expect(peak).toBe(8);
    // Everything else finished while game 1 was still running.
    expect(order.at(-1)).toBe(1);
    expect(order).toHaveLength(20);
  });

  it('retries a game when Steam is busy', async () => {
    const attempts = mockSync(async (_, attempt) =>
      attempt === 1
        ? json({ error: 'Steam is busy' }, { status: 503, headers: { 'Retry-After': '0' } })
        : json({ success: true }),
    );

    const { result } = renderHook(() => useGameSync(), { wrapper });
    await act(() => result.current.startSync(games(3)));

    expect([...attempts.values()]).toEqual([2, 2, 2]);
  });
});

describe('background HowLongToBeat filling', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const games = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ app_id: i + 1, name: `Game ${i + 1}` }));

  /**
   * `bulk` answers the cache lookup, `sync` each full sync, and `hltb` each
   * background batch. Returns the batches sent to the HLTB endpoint.
   */
  function mockApi(handlers: {
    bulk: (appIds: number[]) => unknown;
    sync?: (appId: number) => unknown;
    hltb: (appIds: number[], call: number) => unknown;
  }) {
    const batches: number[][] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith('/bulk')) return json(handlers.bulk(body.appIds));
      if (String(url).endsWith('/hltb')) {
        batches.push(body.appIds);
        return json(handlers.hltb(body.appIds, batches.length));
      }
      return json(handlers.sync?.(body.appId) ?? { success: true });
    }) as typeof fetch;
    return batches;
  }

  const found = (appIds: number[]) => ({
    results: appIds.map((appId) => ({ appId, hours: 10 })),
    pending: [],
    retryAfterMs: 0,
  });

  it('looks up times the cache was missing, 5 games at a time', async () => {
    const batches = mockApi({
      bulk: (ids) => ({ resolved: ids.length, synced: 0, remaining: [], hltbPending: ids }),
      hltb: found,
    });

    const { result } = renderHook(() => useGameSync(), { wrapper });
    await act(() => result.current.startSync(games(7)));

    await waitFor(() =>
      expect(batches).toEqual([
        [1, 2, 3, 4, 5],
        [6, 7],
      ]),
    );
  });

  it('follows up on games synced while HLTB was refusing', async () => {
    const batches = mockApi({
      bulk: (ids) => ({ resolved: 0, synced: 0, remaining: ids }),
      sync: (appId) => ({ success: true, hltbPending: appId === 2 }),
      hltb: found,
    });

    const { result } = renderHook(() => useGameSync(), { wrapper });
    await act(() => result.current.startSync(games(3)));

    await waitFor(() => expect(batches).toEqual([[2]]));
  });

  it('waits out a block and carries on with what was left', async () => {
    jest.useFakeTimers();
    try {
      const batches = mockApi({
        bulk: (ids) => ({ resolved: ids.length, synced: 0, remaining: [], hltbPending: ids }),
        hltb: (ids, call) =>
          call === 1
            ? { results: [{ appId: 1, hours: 10 }], pending: [2, 3], retryAfterMs: 0 }
            : found(ids),
      });

      const { result } = renderHook(() => useGameSync(), { wrapper });
      await act(() => result.current.startSync(games(3)));
      await act(() => jest.advanceTimersByTimeAsync(6_000));

      expect(batches).toEqual([
        [1, 2, 3],
        [2, 3],
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
});
