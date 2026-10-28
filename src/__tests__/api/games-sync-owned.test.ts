/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/sync/route';
import { fetchGameMetadata } from '@/lib/games/metadata-fetch';

jest.mock('@/lib/games/metadata-fetch', () => ({
  ...jest.requireActual('@/lib/games/metadata-fetch'),
  fetchGameMetadata: jest.fn(),
}));
jest.mock('@/lib/supabase/service', () => ({ tryCreateServiceClient: () => null }));

// Whether the caller's library has the game being synced.
let owned = false;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({
          data: table === 'games' && owned ? { id: 1 } : null,
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

const sync = async (body: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/games/sync', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return res.status;
};

beforeEach(() => jest.mocked(fetchGameMetadata).mockReset());

it("refuses a game that isn't in the caller's library, before any lookup", async () => {
  owned = false;
  expect(await sync({ appId: 620, name: 'Portal 2' })).toBe(404);
  expect(fetchGameMetadata).not.toHaveBeenCalled();
});
