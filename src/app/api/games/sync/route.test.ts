/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/sync/route';
import { fetchGameMetadata } from '@/lib/server/metadata-fetch';
import { SteamUnavailableError } from '@/lib/steam/store-api';

jest.mock('@/lib/server/metadata-fetch', () => ({
  ...jest.requireActual('@/lib/server/metadata-fetch'),
  fetchGameMetadata: jest.fn(),
}));
jest.mock('@/lib/supabase/service', () => ({ tryCreateServiceClient: () => null }));

// Whether the caller's library has the game being synced, and its row.
let owned = false;
let ownedRow: Record<string, unknown> = { id: 1 };
const updates: Record<string, unknown>[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({
          data: table === 'games' && owned ? ownedRow : null,
          error: null,
        }),
        update: (values: Record<string, unknown>) => {
          updates.push(values);
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
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
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.mocked(fetchGameMetadata).mockReset();
  ownedRow = { id: 1 };
  updates.length = 0;
});

describe('the art', () => {
  const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg';
  const PICK = 'https://cdn2.steamgriddb.com/grid/abc.png';
  const fetched = {
    app_id: 620,
    platform: 'PC',
    type: 'game',
    name: 'Portal 2',
    genres: [],
    categories: [],
    description: null,
    release_date: 'Apr 18, 2011',
    header_image: STEAM,
    steam_review_score: 98,
    steam_review_count: 1000,
    steam_review_weighted: 97,
    main_story_hours: 8,
    deck_compat: null,
    tags: [],
    hltbUnavailable: false,
  };

  beforeEach(() => {
    owned = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(fetchGameMetadata).mockResolvedValue(fetched as never);
  });

  it("copies Steam's art onto a game that shows it", async () => {
    const { status, body } = await sync({ appId: 620, name: 'Portal 2' });

    expect(status).toBe(200);
    expect(updates[0]).toMatchObject({ header_image: STEAM });
    expect(updates[0]).not.toHaveProperty('default_header_image');
    expect(body.metadata.header_image).toBe(STEAM);
  });

  it('puts it behind art the player chose, which the game goes on showing', async () => {
    ownedRow = { id: 1, header_image: PICK, art_chosen: true };

    const { status, body } = await sync({ appId: 620, name: 'Portal 2' });

    expect(status).toBe(200);
    expect(updates[0]).toMatchObject({ default_header_image: STEAM, main_story_hours: 8 });
    expect(updates[0]).not.toHaveProperty('header_image');
    expect(body.metadata.header_image).toBe(PICK);
  });
});

it("refuses a game that isn't in the caller's library, before any lookup", async () => {
  owned = false;
  expect((await sync({ appId: 620, name: 'Portal 2' })).status).toBe(404);
  expect(fetchGameMetadata).not.toHaveBeenCalled();
});

it('answers an unexpected lookup failure with the error envelope', async () => {
  owned = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(fetchGameMetadata).mockRejectedValue(new Error('boom'));
  expect(await sync({ appId: 620, name: 'Portal 2' })).toEqual({
    status: 500,
    body: { error: 'Failed to fetch game details' },
  });
});

it('asks to retry when Steam is throttling', async () => {
  owned = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(fetchGameMetadata).mockRejectedValue(new SteamUnavailableError(620, '429'));
  const { status, body } = await sync({ appId: 620, name: 'Portal 2' });
  expect(status).toBe(503);
  expect(body.error).toEqual(expect.any(String));
});
