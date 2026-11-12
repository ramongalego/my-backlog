/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/steam/refresh/route';
import { getOwnedGames } from '@/lib/steam/api';
import { syncOwnedGames } from '@/lib/server/steam-library';
import { refreshStoreData } from '@/lib/server/steam-store-data';
import { refreshCriticScores } from '@/lib/server/critic-scores';
import { recheckMissingHours } from '@/lib/server/manual-hours';

let user: { id: string } | null = { id: 'user-1' };
let steamId: string | null = '76561198000000000';
let limited = false;
let steamKey: string | null = 'steam-key';
const limitKeys: string[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: { steam_id: steamId }, error: null }),
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/supabase/service', () => ({ tryCreateServiceClient: () => null }));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async (key: string) => {
    limitKeys.push(key);
    return { success: !limited, limit: 10, remaining: 0, resetAt: Date.now() + 60_000 };
  },
}));
jest.mock('@/lib/server/env', () => ({
  getSteamApiKey: () => {
    if (!steamKey) throw new Error('missing');
    return steamKey;
  },
}));
jest.mock('@/lib/steam/api', () => ({ getOwnedGames: jest.fn() }));
jest.mock('@/lib/server/steam-library', () => ({ syncOwnedGames: jest.fn() }));
jest.mock('@/lib/server/steam-store-data', () => ({ refreshStoreData: jest.fn() }));
jest.mock('@/lib/server/critic-scores', () => ({ refreshCriticScores: jest.fn() }));
jest.mock('@/lib/server/manual-hours', () => ({ recheckMissingHours: jest.fn() }));

const OWNED = [{ appid: 620, name: 'Portal 2', playtime_forever: 480 }];

/** `body` undefined sends no body at all, as the app's ordinary refresh does. */
const refresh = async (body?: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/steam/refresh', {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

const scoreRefreshes = () => [
  jest.mocked(refreshStoreData),
  jest.mocked(refreshCriticScores),
  jest.mocked(recheckMissingHours),
];

beforeEach(() => {
  user = { id: 'user-1' };
  steamId = '76561198000000000';
  limited = false;
  steamKey = 'steam-key';
  limitKeys.length = 0;
  jest
    .mocked(getOwnedGames)
    .mockReset()
    .mockResolvedValue(OWNED as never);
  jest
    .mocked(syncOwnedGames)
    .mockReset()
    .mockResolvedValue({ newGames: 1, updatedPlaytime: 2, updatedGames: 3 });
  jest.mocked(refreshStoreData).mockReset().mockResolvedValue(4);
  jest.mocked(refreshCriticScores).mockReset().mockResolvedValue(5);
  jest.mocked(recheckMissingHours).mockReset().mockResolvedValue(6);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('refuses a signed-out request, without contacting Steam', async () => {
  user = null;
  expect((await refresh()).status).toBe(401);
  expect(getOwnedGames).not.toHaveBeenCalled();
});

it('stops a player past the limit, without contacting Steam', async () => {
  limited = true;

  expect((await refresh()).status).toBe(429);

  expect(limitKeys).toEqual(['steam-refresh:user-1']);
  expect(getOwnedGames).not.toHaveBeenCalled();
  for (const fn of scoreRefreshes()) expect(fn).not.toHaveBeenCalled();
});

it("syncs the player's Steam library and refreshes scores, art and missing hours", async () => {
  const res = await refresh();

  expect(res.status).toBe(200);
  expect(getOwnedGames).toHaveBeenCalledWith('76561198000000000', 'steam-key');
  expect(syncOwnedGames).toHaveBeenCalledWith(expect.anything(), 'user-1', OWNED);
  expect(res.body).toEqual({
    success: true,
    newGames: 1,
    updatedPlaytime: 2,
    updatedGames: 3,
    updatedStoreData: 4,
    updatedCriticScores: 5,
    updatedHours: 6,
  });
});

it('skips Steam for a player without it, and still refreshes games added by hand', async () => {
  steamId = null;
  // No Steam key is needed for that either.
  steamKey = null;

  const res = await refresh();

  expect(res.status).toBe(200);
  expect(getOwnedGames).not.toHaveBeenCalled();
  expect(syncOwnedGames).not.toHaveBeenCalled();
  expect(res.body).toMatchObject({ newGames: 0, updatedPlaytime: 0, updatedGames: 0 });
  for (const fn of scoreRefreshes()) expect(fn.mock.calls[0][1]).toBe('user-1');
});

describe('the daily score refresh', () => {
  it('is skipped when asked ({ reviews: false })', async () => {
    const res = await refresh({ reviews: false });

    expect(res.status).toBe(200);
    for (const fn of scoreRefreshes()) expect(fn).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      updatedStoreData: 0,
      updatedCriticScores: 0,
      updatedHours: 0,
      newGames: 1,
    });
  });

  it.each([
    ['no body', undefined],
    ['a null body', null],
    ['an empty body', {}],
    ['reviews: true', { reviews: true }],
  ])('runs with %s', async (_, body) => {
    expect((await refresh(body)).status).toBe(200);
    for (const fn of scoreRefreshes()) expect(fn).toHaveBeenCalledTimes(1);
  });

  it("doesn't fail the refresh when one part of it does", async () => {
    jest.mocked(refreshStoreData).mockRejectedValue(new Error('Steam store 429'));

    const res = await refresh();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      updatedStoreData: 0,
      updatedCriticScores: 5,
      updatedHours: 6,
      newGames: 1,
    });
  });
});

describe('when Steam lets it down', () => {
  it("is a server error when the Steam key isn't configured", async () => {
    steamKey = null;
    expect((await refresh()).status).toBe(500);
    expect(getOwnedGames).not.toHaveBeenCalled();
  });

  it("says Steam failed when the library can't be fetched, and changes nothing", async () => {
    jest.mocked(getOwnedGames).mockRejectedValue(new Error('Steam 503'));

    const res = await refresh();

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Steam API failed' });
    expect(syncOwnedGames).not.toHaveBeenCalled();
    for (const fn of scoreRefreshes()) expect(fn).not.toHaveBeenCalled();
  });

  it("says so when the library couldn't be saved", async () => {
    jest.mocked(syncOwnedGames).mockRejectedValue(new Error('db down'));

    const res = await refresh();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to update library' });
  });
});
