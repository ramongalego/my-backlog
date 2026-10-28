/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/sync/hltb/route';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';

jest.mock('@/lib/hltb/api', () => ({
  ...jest.requireActual('@/lib/hltb/api'),
  getMainStoryHours: jest.fn(),
  hltbBlockedForMs: () => 20_000,
}));

const userGames = [
  { app_id: 1, name: 'Celeste' },
  { app_id: 2, name: 'Hades' },
  { app_id: 3, name: 'Portal 2' },
];
let cacheRows: {
  app_id: number;
  name: string | null;
  main_story_hours: number | null;
  hltb_attempts: number;
}[];
const userUpdates: Record<string, unknown>[] = [];
const cacheUpdates: Record<string, unknown>[] = [];

/** A chainable query that records `.update()` payloads with the ids they target. */
function table(rows: { app_id: number }[], updates: Record<string, unknown>[]) {
  let pendingUpdate: Record<string, unknown> | null = null;
  let selected = rows;
  const builder: Record<string, unknown> = {
    select: () => builder,
    in: (_: string, ids: number[]) => {
      selected = rows.filter((r) => ids.includes(r.app_id));
      return builder;
    },
    update: (values: Record<string, unknown>) => {
      pendingUpdate = values;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      if (pendingUpdate && column === 'app_id') updates.push({ app_id: value, ...pendingUpdate });
      return builder;
    },
    then: (resolve: (v: unknown) => unknown) => resolve({ data: selected, error: null }),
  };
  return builder;
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: (name: string) =>
      name === 'games' ? table(userGames, userUpdates) : table(cacheRows, cacheUpdates),
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({ from: () => table([], cacheUpdates) }),
}));

const call = async (appIds: number[]) => {
  const request = new Request('http://localhost/api/games/sync/hltb', {
    method: 'POST',
    body: JSON.stringify({ appIds }),
  }) as unknown as NextRequest;
  const response = await POST(request);
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  userUpdates.length = 0;
  cacheUpdates.length = 0;
  cacheRows = userGames.map((g) => ({
    app_id: g.app_id,
    name: g.name,
    main_story_hours: null,
    hltb_attempts: 0,
  }));
  jest.mocked(getMainStoryHours).mockReset();
});

it('looks up each game and saves the times it finds', async () => {
  jest.mocked(getMainStoryHours).mockImplementation(async (name) => (name === 'Hades' ? null : 9));

  const { status, body } = await call([1, 2, 3]);

  expect(status).toBe(200);
  expect(body).toEqual({
    results: [
      { appId: 1, hours: 9 },
      { appId: 2, hours: null },
      { appId: 3, hours: 9 },
    ],
    pending: [],
    retryAfterMs: 0,
  });
  expect(userUpdates).toEqual([
    { app_id: 1, main_story_hours: 9 },
    { app_id: 3, main_story_hours: 9 },
  ]);
  // A real miss advances the shared backoff; found times reset it.
  expect(cacheUpdates).toContainEqual({ app_id: 2, hltb_attempts: 1 });
  expect(cacheUpdates).toContainEqual({ app_id: 1, main_story_hours: 9, hltb_attempts: 0 });
});

it("searches by Steam's name, so renaming a game in your library can't set the shared time", async () => {
  // The library row says one game; Steam's name for the app is another.
  cacheRows[0].name = 'Celeste (Steam)';
  jest.mocked(getMainStoryHours).mockResolvedValue(9);

  await call([1]);

  expect(getMainStoryHours).toHaveBeenCalledWith('Celeste (Steam)');
  expect(getMainStoryHours).not.toHaveBeenCalledWith('Celeste');
});

it("doesn't write the shared cache without Steam's name to search by", async () => {
  cacheRows[0].name = null;
  jest.mocked(getMainStoryHours).mockResolvedValue(9);

  await call([1]);

  expect(cacheUpdates).toEqual([]);
  // The caller's own row still gets the time.
  expect(userUpdates).toEqual([{ app_id: 1, main_story_hours: 9 }]);
});

it('hands back the rest, with how long to wait, once HLTB starts refusing', async () => {
  jest
    .mocked(getMainStoryHours)
    .mockResolvedValueOnce(9)
    .mockRejectedValue(new HLTBUnavailableError());

  const { body } = await call([1, 2, 3]);

  expect(body).toEqual({
    results: [{ appId: 1, hours: 9 }],
    pending: [2, 3],
    retryAfterMs: 20_000,
  });
  // A refusal is not a miss.
  expect(cacheUpdates.some((u) => u.app_id === 2)).toBe(false);
});

it('uses a time someone else already found without asking HLTB', async () => {
  cacheRows[0].main_story_hours = 8.3;
  jest.mocked(getMainStoryHours).mockResolvedValue(null);

  const { body } = await call([1]);

  expect(body.results).toEqual([{ appId: 1, hours: 8.3 }]);
  expect(getMainStoryHours).not.toHaveBeenCalledWith('Celeste');
  expect(userUpdates).toEqual([{ app_id: 1, main_story_hours: 8.3 }]);
});

it('rejects oversized batches', async () => {
  expect((await call([1, 2, 3, 4, 5, 6])).status).toBe(400);
});
