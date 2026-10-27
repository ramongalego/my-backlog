/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/games/manual/[id]/route';

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

beforeEach(() => {
  updates.length = 0;
  playtime = 300;
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
