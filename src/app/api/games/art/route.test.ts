/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/games/art/route';
import { listWideArt } from '@/lib/steamgriddb/api';

type Row = Record<string, unknown>;

const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg';
const PICK = 'https://cdn2.steamgriddb.com/grid/abc.png';
const choice = (name: string) => ({
  url: `https://cdn2.steamgriddb.com/grid/${name}.png`,
  thumb: `https://cdn2.steamgriddb.com/thumb/${name}.jpg`,
});

let user: { id: string } | null = { id: 'user-1' };
let game: Row | null = null;
const updates: Row[] = [];

jest.mock('@/lib/steamgriddb/api', () => ({ listWideArt: jest.fn() }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: game, error: null }),
        update: (values: Row) => {
          updates.push(values);
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({ success: true }),
}));

const steamGame = (overrides: Row = {}): Row => ({
  id: 7,
  name: 'Hades',
  source: 'steam',
  app_id: 1145360,
  steam_app_id: null,
  release_date: 'Sep 17, 2020',
  header_image: STEAM,
  art_chosen: false,
  default_header_image: null,
  ...overrides,
});

const choices = (query = '?gameId=7') =>
  GET(new Request(`http://localhost/api/games/art${query}`) as unknown as NextRequest);
const save = (body: unknown) =>
  POST(
    new Request('http://localhost/api/games/art', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );

beforeEach(() => {
  user = { id: `user-${Math.random()}` };
  game = steamGame();
  updates.length = 0;
  jest
    .mocked(listWideArt)
    .mockReset()
    .mockResolvedValue([choice('a'), choice('b')]);
});

describe('the choices', () => {
  it('refuses a signed-out request, and a bad game id', async () => {
    expect((await choices('?gameId=seven')).status).toBe(400);
    expect((await choices('')).status).toBe(400);
    user = null;
    expect((await choices()).status).toBe(401);
    expect(listWideArt).not.toHaveBeenCalled();
  });

  it("doesn't ask SteamGridDB about a game that isn't the player's", async () => {
    game = null;
    expect((await choices()).status).toBe(404);
    expect(listWideArt).not.toHaveBeenCalled();
  });

  it('looks a Steam game up by its Steam id, with its name and year to fall back on', async () => {
    const res = await choices();

    expect(res.status).toBe(200);
    expect(listWideArt).toHaveBeenCalledWith({ name: 'Hades', year: 2020, steamAppId: 1145360 });
    expect(await res.json()).toEqual({
      original: STEAM,
      current: STEAM,
      choices: [choice('a'), choice('b')],
    });
  });

  it('uses the Steam id of a console game that Steam also sells, or none', async () => {
    game = steamGame({ source: 'manual', app_id: null, steam_app_id: 99, release_date: null });
    await choices();
    expect(listWideArt).toHaveBeenLastCalledWith({ name: 'Hades', year: null, steamAppId: 99 });

    game = steamGame({ source: 'manual', app_id: null, steam_app_id: null });
    await choices();
    expect(listWideArt).toHaveBeenLastCalledWith({ name: 'Hades', year: 2020, steamAppId: null });
  });

  it('gives the original behind a choice, and never lists it twice', async () => {
    game = steamGame({
      source: 'manual',
      header_image: choice('b').url,
      art_chosen: true,
      default_header_image: choice('a').url,
    });

    expect(await (await choices()).json()).toEqual({
      original: choice('a').url,
      current: choice('b').url,
      choices: [choice('b')],
    });
  });

  it("says so when SteamGridDB can't be reached", async () => {
    jest.mocked(listWideArt).mockResolvedValue(null);
    const res = await choices();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/SteamGridDB/);
  });
});

describe('saving a pick', () => {
  it('refuses a signed-out request, and a body without a game or a url', async () => {
    expect((await save({ url: PICK })).status).toBe(400);
    expect((await save({ gameId: 7 })).status).toBe(400);
    expect((await save({ gameId: 7, url: 'not a url' })).status).toBe(400);
    user = null;
    expect((await save({ gameId: 7, url: PICK })).status).toBe(401);
    expect(updates).toEqual([]);
  });

  it("refuses a game that isn't the player's", async () => {
    game = null;
    expect((await save({ gameId: 7, url: PICK })).status).toBe(404);
    expect(updates).toEqual([]);
  });

  it('shows the pick, marks it chosen and keeps the original behind it', async () => {
    const res = await save({ gameId: 7, url: PICK });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ header_image: PICK });
    expect(updates).toEqual([
      { header_image: PICK, art_chosen: true, default_header_image: STEAM },
    ]);
  });

  it('goes back to the original with a null url', async () => {
    game = steamGame({ header_image: PICK, art_chosen: true, default_header_image: STEAM });

    expect(await (await save({ gameId: 7, url: null })).json()).toEqual({ header_image: STEAM });
    expect(updates).toEqual([
      { header_image: STEAM, art_chosen: false, default_header_image: null },
    ]);
  });

  it('refuses an image from anywhere but SteamGridDB: art shows on public share pages', async () => {
    const res = await save({ gameId: 7, url: 'https://example.com/anything.png' });

    expect(res.status).toBe(400);
    expect(updates).toEqual([]);
  });
});
