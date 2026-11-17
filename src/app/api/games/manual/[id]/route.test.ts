/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/games/manual/[id]/route';
import { steamHoursOf } from '@/lib/server/steam-hours';

jest.mock('@/lib/server/steam-hours', () => ({ steamHoursOf: jest.fn() }));

const updates: Record<string, unknown>[] = [];
// The game's hours saved so far, in minutes; null when it isn't found.
let playtime: number | null = 0;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: () => {
      const builder = {
        select: () => builder,
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return builder;
        },
        or: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data: playtime === null ? null : { playtime_forever: playtime },
          error: null,
        }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: [{ id: 7 }], error: null }),
      };
      return builder;
    },
  }),
}));

const saveHours = async (hoursPlayed: number) => {
  const res = await PATCH(
    new Request('http://localhost/api/games/manual/7', {
      method: 'PATCH',
      body: JSON.stringify({ hoursPlayed }),
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: '7' }) },
  );
  return res?.status;
};

const moveBackToSteam = async () => {
  const res = await PATCH(
    new Request('http://localhost/api/games/manual/7', {
      method: 'PATCH',
      body: JSON.stringify({ playOnSteam: true }),
    }) as unknown as NextRequest,
    { params: Promise.resolve({ id: '7' }) },
  );
  return res?.status;
};

beforeEach(() => {
  updates.length = 0;
  playtime = 300;
  jest.mocked(steamHoursOf).mockReset().mockResolvedValue(null);
});

it('makes today the last-played date when you log more hours', async () => {
  expect(await saveHours(6)).toBe(200);
  expect(updates[0]).toEqual({ playtime_forever: 360, last_played_at: expect.any(String) });
  expect(Date.now() - Date.parse(updates[0].last_played_at as string)).toBeLessThan(5000);
});

it("doesn't when you correct the hours down, or save the same", async () => {
  await saveHours(4);
  await saveHours(5);
  expect(updates).toEqual([{ playtime_forever: 240 }, { playtime_forever: 300 }]);
});

it("refuses a game that isn't on a console, or isn't yours", async () => {
  playtime = null;
  expect(await saveHours(6)).toBe(404);
  expect(updates).toHaveLength(0);
});

describe('moving a game back to Steam', () => {
  it("saves Steam's hours and last-played date with the move, in one write", async () => {
    jest.mocked(steamHoursOf).mockResolvedValue({
      playtime_forever: 3050,
      last_played_at: '2026-11-16T22:15:00.000Z',
    });

    expect(await moveBackToSteam()).toBe(200);

    expect(steamHoursOf).toHaveBeenCalledWith(expect.anything(), expect.any(String), 7);
    expect(updates).toEqual([
      {
        platform: 'PC',
        igdb_id: null,
        playtime_forever: 3050,
        last_played_at: '2026-11-16T22:15:00.000Z',
      },
    ]);
  });

  it('saves a Steam total of none, and no last-played date, for a game never played there', async () => {
    jest.mocked(steamHoursOf).mockResolvedValue({ playtime_forever: 0, last_played_at: null });
    await moveBackToSteam();
    expect(updates).toEqual([
      { platform: 'PC', igdb_id: null, playtime_forever: 0, last_played_at: null },
    ]);
  });

  it("still moves the game when Steam can't say, leaving its hours for the next sync", async () => {
    expect(await moveBackToSteam()).toBe(200);
    expect(updates).toEqual([{ platform: 'PC', igdb_id: null }]);
  });

  it("doesn't ask Steam when only the hours are being saved", async () => {
    await saveHours(6);
    expect(steamHoursOf).not.toHaveBeenCalled();
  });
});
