/**
 * @jest-environment node
 */
import { findWideArt } from '@/lib/steamgriddb/api';

process.env.STEAM_GRID_API_KEY = 'key';

const respond = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data })));
let search: unknown[] = [];
let grids: Record<number, unknown[]> = {};
const requests: string[] = [];

beforeEach(() => {
  requests.length = 0;
  global.fetch = jest.fn((url: string | URL) => {
    const path = String(url);
    requests.push(path);
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
