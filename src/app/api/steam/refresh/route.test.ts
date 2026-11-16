/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/steam/refresh/route';
import { getOwnedGames, getPlayerSummary } from '@/lib/steam/api';
import { clearLibrary, syncOwnedGames } from '@/lib/server/steam-library';
import { refreshStoreData } from '@/lib/server/steam-store-data';
import { refreshCriticScores } from '@/lib/server/critic-scores';
import { recheckManualHours } from '@/lib/server/manual-hours';

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
        single: async () => ({
          data: {
            steam_id: steamId,
            steam_username: 'Ankrath',
            steam_avatar: 'https://avatars.steamstatic.com/old.jpg',
          },
          error: null,
        }),
      };
      return builder;
    },
  }),
}));
// The service client, which saves a changed Steam name and picture.
const profileUpdates: Record<string, unknown>[] = [];
const service = {
  from: () => ({
    update: (values: Record<string, unknown>) => ({
      // By the player, and by the Steam account the name was read from.
      eq: () => ({
        eq: async (_column: string, linkedTo: string) => {
          profileUpdates.push({ ...values, linkedTo });
          return { error: null };
        },
      }),
    }),
  }),
};
jest.mock('@/lib/supabase/service', () => ({ tryCreateServiceClient: () => service }));
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
jest.mock('@/lib/steam/api', () => ({ getOwnedGames: jest.fn(), getPlayerSummary: jest.fn() }));
jest.mock('@/lib/server/steam-library', () => ({
  syncOwnedGames: jest.fn(),
  clearLibrary: jest.fn(),
}));
jest.mock('@/lib/server/steam-store-data', () => ({ refreshStoreData: jest.fn() }));
jest.mock('@/lib/server/critic-scores', () => ({ refreshCriticScores: jest.fn() }));
jest.mock('@/lib/server/manual-hours', () => ({ recheckManualHours: jest.fn() }));

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
  jest.mocked(recheckManualHours),
];

beforeEach(() => {
  user = { id: 'user-1' };
  steamId = '76561198000000000';
  limited = false;
  steamKey = 'steam-key';
  limitKeys.length = 0;
  profileUpdates.length = 0;
  // Steam has the same name and picture as saved, unless a test says otherwise.
  jest
    .mocked(getPlayerSummary)
    .mockReset()
    .mockResolvedValue({
      personaname: 'Ankrath',
      avatarfull: 'https://avatars.steamstatic.com/old.jpg',
    } as never);
  jest
    .mocked(getOwnedGames)
    .mockReset()
    .mockResolvedValue({ games: OWNED, isPrivate: false } as never);
  jest
    .mocked(syncOwnedGames)
    .mockReset()
    .mockResolvedValue({ newGames: 1, updatedPlaytime: 2, updatedGames: 3 });
  jest.mocked(clearLibrary).mockReset().mockResolvedValue(undefined);
  jest.mocked(refreshStoreData).mockReset().mockResolvedValue(4);
  jest.mocked(refreshCriticScores).mockReset().mockResolvedValue(5);
  jest.mocked(recheckManualHours).mockReset().mockResolvedValue(6);
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

describe('the Steam name and picture', () => {
  it('are saved and given back when they changed on Steam', async () => {
    jest.mocked(getPlayerSummary).mockResolvedValue({
      personaname: 'Big Boss',
      avatarfull: 'https://avatars.steamstatic.com/new.jpg',
    } as never);

    const res = await refresh();

    expect(getPlayerSummary).toHaveBeenCalledWith('76561198000000000', 'steam-key');
    expect(profileUpdates).toEqual([
      expect.objectContaining({
        steam_username: 'Big Boss',
        steam_avatar: 'https://avatars.steamstatic.com/new.jpg',
        // Only while that Steam account is still the one linked.
        linkedTo: '76561198000000000',
      }),
    ]);
    expect(res.body.steamProfile).toEqual({
      username: 'Big Boss',
      avatar: 'https://avatars.steamstatic.com/new.jpg',
    });
  });

  it('are left alone when Steam has the same ones', async () => {
    const res = await refresh();
    expect(profileUpdates).toEqual([]);
    expect(res.body).not.toHaveProperty('steamProfile');
  });

  it("don't fail the refresh when Steam can't give them", async () => {
    jest.mocked(getPlayerSummary).mockRejectedValue(new Error('Steam API error: 500'));
    const res = await refresh();
    expect(res.status).toBe(200);
    expect(syncOwnedGames).toHaveBeenCalled();
    expect(profileUpdates).toEqual([]);
  });

  it('keep the saved name when Steam gives none', async () => {
    jest.mocked(getPlayerSummary).mockResolvedValue({ personaname: ' ', avatarfull: '' } as never);
    await refresh();
    expect(profileUpdates).toEqual([]);
  });
});

describe('when Steam is disconnected while a refresh is running', () => {
  it('imports nothing if it happened while Steam was answering', async () => {
    jest.mocked(getOwnedGames).mockImplementation(async () => {
      steamId = null;
      return { games: OWNED, isPrivate: false } as never;
    });

    const res = await refresh();

    expect(res.status).toBe(200);
    expect(syncOwnedGames).not.toHaveBeenCalled();
    expect(profileUpdates).toEqual([]);
    expect(res.body).toMatchObject({ newGames: 0, updatedPlaytime: 0 });
  });

  it('takes the games out again if it happened while they were being written', async () => {
    jest.mocked(syncOwnedGames).mockImplementation(async () => {
      steamId = null;
      return { newGames: 210, updatedPlaytime: 0, updatedGames: 0 };
    });

    const res = await refresh();

    expect(clearLibrary).toHaveBeenCalledWith(expect.anything(), 'user-1');
    // Nothing is reported as added, and the old Steam name isn't written back.
    expect(res.body).toMatchObject({ newGames: 0 });
    expect(profileUpdates).toEqual([]);
  });

  it('leaves another Steam account alone, when the player switched to it meanwhile', async () => {
    jest.mocked(getOwnedGames).mockImplementation(async () => {
      steamId = '76561198999999999';
      return { games: OWNED, isPrivate: false } as never;
    });
    await refresh();
    expect(syncOwnedGames).not.toHaveBeenCalled();
    expect(clearLibrary).not.toHaveBeenCalled();
  });
});

it('skips Steam for a player without it, and still refreshes games added by hand', async () => {
  steamId = null;
  // No Steam key is needed for that either.
  steamKey = null;

  const res = await refresh();

  expect(res.status).toBe(200);
  expect(getOwnedGames).not.toHaveBeenCalled();
  expect(getPlayerSummary).not.toHaveBeenCalled();
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

it('says when Steam shared no library, so the app can tell the player why', async () => {
  jest.mocked(getOwnedGames).mockResolvedValue({ games: [], isPrivate: true });
  jest
    .mocked(syncOwnedGames)
    .mockResolvedValue({ newGames: 0, updatedPlaytime: 0, updatedGames: 0 });

  const res = await refresh();

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, steamPrivate: true, newGames: 0 });
  // Nothing of the library that's already here is touched.
  expect(syncOwnedGames).toHaveBeenCalledWith(expect.anything(), 'user-1', []);
});
