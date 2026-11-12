/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/share/completion/route';

let user: { id: string } | null = { id: 'user-1' };
const inserted: Record<string, unknown>[] = [];

// ESM-only, which Jest can't load here: the id itself isn't what's tested.
jest.mock('nanoid', () => ({ nanoid: () => 'share-id' }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => (inserted.push(row), { error: null }),
    }),
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({ success: true }),
}));

const share = (body: unknown) =>
  POST(
    new Request('http://localhost/api/share/completion', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );

beforeEach(() => {
  user = { id: 'user-1' };
  inserted.length = 0;
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await share({ gameName: 'Celeste' })).status).toBe(401);
});

it('refuses a share with no game name', async () => {
  expect((await share({ gameName: ' ' })).status).toBe(400);
  expect(inserted).toEqual([]);
});

it.each([
  ['Steam', 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg'],
  ['IGDB', 'https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg'],
  ['SteamGridDB', 'https://cdn2.steamgriddb.com/grid/abc.png'],
])('shares a game with %s art', async (_, headerImage) => {
  const res = await share({ gameName: 'Pokémon Platinum', headerImage, rating: 9 });

  expect(res.status).toBe(200);
  expect((await res.json()).url).toMatch(/^\/share\/completion\/.+/);
  expect(inserted[0]).toMatchObject({
    user_id: 'user-1',
    game_name: 'Pokémon Platinum',
    header_image: headerImage,
    rating: 9,
  });
});

it('still shares, without the art, when the art is from anywhere else', async () => {
  const res = await share({ gameName: 'Celeste', headerImage: 'https://example.com/a.jpg' });

  expect(res.status).toBe(200);
  expect(inserted[0]).toMatchObject({ game_name: 'Celeste', header_image: null });
});
