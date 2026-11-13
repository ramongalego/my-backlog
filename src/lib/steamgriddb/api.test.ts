/**
 * @jest-environment node
 */
import { findWideArt, listWideArt } from '@/lib/steamgriddb/api';

process.env.STEAM_GRID_API_KEY = 'key';

const respond = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data })));
let search: unknown[] = [];
let grids: Record<number, unknown[]> = {};
// Grids by Steam app id, which SteamGridDB also answers to.
let steamGrids: Record<number, unknown[] | 'missing'> = {};
const requests: string[] = [];

beforeEach(() => {
  requests.length = 0;
  steamGrids = {};
  global.fetch = jest.fn((url: string | URL) => {
    const path = String(url);
    requests.push(path);
    const steamId = Number(/\/grids\/steam\/(\d+)/.exec(path)?.[1]);
    if (steamId) {
      const found = steamGrids[steamId] ?? 'missing';
      return found === 'missing'
        ? Promise.resolve(new Response('{"success":false}', { status: 404 }))
        : respond(found);
    }
    if (path.includes('/search/autocomplete/')) return respond(search);
    const id = Number(/\/grids\/game\/(\d+)/.exec(path)?.[1]);
    return respond(grids[id] ?? []);
  }) as unknown as typeof fetch;
});

const year = (y: number) => Date.UTC(y, 5, 1) / 1000;
const grid = (url: string, width = 920, style = 'alternate') => ({
  url,
  width,
  style,
  language: 'en',
});

it('finds the game by its exact name and takes its first full-size art', async () => {
  search = [
    { id: 1, name: 'Pokémon Shield', release_date: year(2019) },
    { id: 2, name: 'Pokemon Armored Shield' },
  ];
  grids = { 1: [grid('blur.png', 920, 'blurred'), grid('small.png', 460), grid('big.png')] };
  expect(await findWideArt('Pokémon Shield', 2019)).toBe('big.png');
  // Steam's header shape, no animations or flagged art.
  expect(requests[1]).toContain('dimensions=920x430,460x215');
  expect(requests[1]).toContain('nsfw=false');
});

it('ignores punctuation and accents in names', async () => {
  search = [{ id: 1, name: 'Fire Emblem: Fortune’s Weave', release_date: year(2026) }];
  grids = { 1: [grid('fe.png')] };
  expect(await findWideArt("Fire Emblem: Fortune's Weave", 2026)).toBe('fe.png');
});

it('tells a remake from its original by year', async () => {
  search = [
    { id: 1, name: 'The Legend of Zelda: Ocarina of Time', release_date: year(1998) },
    { id: 2, name: 'The Legend of Zelda: Ocarina of Time', release_date: year(2026) },
  ];
  grids = { 1: [grid('n64.png')], 2: [grid('remake.png')] };
  expect(await findWideArt('The Legend of Zelda: Ocarina of Time', 2026)).toBe('remake.png');
  // A namesake years away isn't the game.
  search = [search[0], { ...(search[0] as object), id: 3, release_date: year(2011) }];
  expect(await findWideArt('The Legend of Zelda: Ocarina of Time', 2026)).toBeNull();
});

it('takes a lone match whatever its year, as IGDB may date a later re-release', async () => {
  search = [{ id: 1, name: 'Metroid Prime', release_date: year(2002) }];
  grids = { 1: [grid('prime.png')] };
  expect(await findWideArt('Metroid Prime', 2009)).toBe('prime.png');
});

it('has nothing for a game it only knows by another name, or without a key', async () => {
  search = [{ id: 1, name: 'Pokémon Sword and Shield' }];
  expect(await findWideArt('Pokémon Shield', 2019)).toBeNull();
  delete process.env.STEAM_GRID_API_KEY;
  expect(await findWideArt('Pokémon Shield', 2019)).toBeNull();
  process.env.STEAM_GRID_API_KEY = 'key';
});

it('never throws: a failed lookup is just no art', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(await findWideArt('Pokémon Shield', 2019)).toBeNull();
});

describe('listWideArt', () => {
  const thumbed = (name: string, width = 920, style = 'alternate') => ({
    ...grid(`${name}.png`, width, style),
    thumb: `${name}-thumb.jpg`,
  });
  const hades = { name: 'Hades', year: 2020, steamAppId: 1145360 };

  it('finds a Steam game by its Steam id, without searching by name', async () => {
    steamGrids = { 1145360: [thumbed('a'), thumbed('b')] };

    expect(await listWideArt(hades)).toEqual([
      { url: 'a.png', thumb: 'a-thumb.jpg' },
      { url: 'b.png', thumb: 'b-thumb.jpg' },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('/grids/steam/1145360?dimensions=920x430,460x215');
  });

  it('falls back to the name when SteamGridDB has nothing under the Steam id', async () => {
    search = [{ id: 5, name: 'Hades', release_date: year(2020) }];
    grids = { 5: [thumbed('named')] };

    expect(await listWideArt(hades)).toEqual([{ url: 'named.png', thumb: 'named-thumb.jpg' }]);
  });

  it('finds a console game by its exact name and year, as findWideArt does', async () => {
    search = [
      { id: 1, name: 'The Legend of Zelda: Ocarina of Time', release_date: year(1998) },
      { id: 2, name: 'The Legend of Zelda: Ocarina of Time', release_date: year(2026) },
    ];
    grids = { 1: [thumbed('n64')], 2: [thumbed('remake')] };

    expect(
      await listWideArt({
        name: 'The Legend of Zelda: Ocarina of Time',
        year: 2026,
        steamAppId: null,
      }),
    ).toEqual([{ url: 'remake.png', thumb: 'remake-thumb.jpg' }]);
  });

  it('lists only art, full size first, each image once, and no more than the picker shows', async () => {
    steamGrids = {
      1145360: [
        thumbed('small', 460),
        thumbed('blur', 920, 'blurred'),
        thumbed('big'),
        thumbed('big'),
        ...Array.from({ length: 30 }, (_, i) => thumbed(`more-${i}`)),
      ],
    };

    const choices = await listWideArt(hades);

    expect(choices).toHaveLength(17);
    expect(choices!.map((c) => c.url).slice(0, 2)).toEqual(['big.png', 'more-0.png']);
    expect(choices!.some((c) => c.url === 'blur.png')).toBe(false);
    expect(choices!.filter((c) => c.url === 'big.png')).toHaveLength(1);
  });

  it('uses the art itself where SteamGridDB gives no small copy', async () => {
    steamGrids = { 1145360: [grid('plain.png')] };
    expect(await listWideArt(hades)).toEqual([{ url: 'plain.png', thumb: 'plain.png' }]);
  });

  it('is empty for a game SteamGridDB has no art for or only knows by another name', async () => {
    search = [{ id: 1, name: 'Hades II' }];
    expect(await listWideArt(hades)).toEqual([]);
  });

  it("is null, not empty, when SteamGridDB can't be asked", async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response('', { status: 503 })),
    ) as unknown as typeof fetch;
    expect(await listWideArt(hades)).toBeNull();

    global.fetch = jest.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    expect(await listWideArt(hades)).toBeNull();

    delete process.env.STEAM_GRID_API_KEY;
    expect(await listWideArt(hades)).toBeNull();
    process.env.STEAM_GRID_API_KEY = 'key';
  });
});
