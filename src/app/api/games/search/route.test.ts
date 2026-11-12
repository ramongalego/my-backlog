/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/games/search/route';
import { searchGames } from '@/lib/igdb/api';
import { getAddableGameDetails } from '@/lib/server/manual-details';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

type Row = Record<string, unknown>;

let user: { id: string } | null = null;
// A fresh user per test, so the in-memory limiter starts from zero.
let userCount = 0;
let library: Row[] = [];
let libraryError: Error | null = null;
const lookups: { filters: Record<string, unknown> }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    // Enough of the query builder for the route's two library lookups.
    from: () => {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          filters[col] = vals;
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) => {
          lookups.push({ filters });
          const rows = library.filter((row) =>
            Object.entries(filters).every(([col, val]) =>
              Array.isArray(val) ? val.includes(row[col]) : row[col] === val,
            ),
          );
          return resolve({ data: libraryError ? null : rows, error: libraryError });
        },
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/igdb/api', () => ({ searchGames: jest.fn() }));
jest.mock('@/lib/server/manual-details', () => ({ getAddableGameDetails: jest.fn() }));

const get = (query: string) =>
  GET(new Request(`http://localhost/api/games/search${query}`) as unknown as NextRequest);

const found = (igdbId: number, name: string, steamAppIds: number[] = []) => ({
  igdbId,
  name,
  year: 2020,
  cover: null,
  platforms: ['Switch'],
  steamAppIds,
});

beforeEach(() => {
  user = { id: `search-user-${++userCount}` };
  library = [];
  libraryError = null;
  lookups.length = 0;
  jest.mocked(searchGames).mockReset().mockResolvedValue([]);
  jest.mocked(getAddableGameDetails).mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('refuses a signed-out request, without asking IGDB', async () => {
  user = null;
  expect((await get('?q=zelda')).status).toBe(401);
  expect(searchGames).not.toHaveBeenCalled();
});

describe('searching', () => {
  it.each([
    ['nothing', ''],
    ['one character', '?q=z'],
    ['only spaces', '?q=%20%20%20'],
  ])('asks for more than %s, without asking IGDB', async (_, query) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(searchGames).not.toHaveBeenCalled();
  });

  it('returns what IGDB found, trimmed of the spaces around the search', async () => {
    jest.mocked(searchGames).mockResolvedValue([found(1, 'Hades')] as never);

    const res = await get('?q=%20hades%20');

    expect(res.status).toBe(200);
    expect(searchGames).toHaveBeenCalledWith('hades');
    expect((await res.json()).results).toEqual([
      {
        igdbId: 1,
        name: 'Hades',
        year: 2020,
        cover: null,
        platforms: ['Switch'],
        libraryGame: null,
      },
    ]);
  });

  it('marks the games already in the library, from Steam or added by hand', async () => {
    jest
      .mocked(searchGames)
      .mockResolvedValue([
        found(1, 'Hades', [1145360]),
        found(2, 'Metroid Dread'),
        found(3, 'Tunic', [553420]),
      ] as never);
    library = [
      {
        user_id: user!.id,
        source: 'steam',
        id: 10,
        app_id: 1145360,
        igdb_id: null,
        status: 'dropped',
        platform: 'PC',
        finished_at: null,
        dropped_at: '2026-03-01',
        notes: 'Not for me',
        rating: 4,
      },
      {
        user_id: user!.id,
        source: 'manual',
        id: 11,
        app_id: null,
        igdb_id: 2,
        status: 'finished',
        platform: 'Switch',
        finished_at: '2026-05-05',
        dropped_at: null,
        notes: null,
        rating: 9,
      },
      // Another player's copy of Tunic is not this player's.
      { user_id: 'someone-else', source: 'steam', id: 12, app_id: 553420, status: 'backlog' },
    ];

    const { results } = await (await get('?q=games')).json();

    expect(results.map((r: Row) => r.libraryGame)).toEqual([
      {
        id: 10,
        fromSteam: true,
        status: 'dropped',
        platform: 'PC',
        date: '2026-03-01',
        notes: 'Not for me',
        rating: 4,
      },
      {
        id: 11,
        fromSteam: false,
        status: 'finished',
        platform: 'Switch',
        date: '2026-05-05',
        notes: null,
        rating: 9,
      },
      null,
    ]);
    // Every lookup is limited to the signed-in player's games.
    expect(lookups.length).toBeGreaterThan(0);
    for (const lookup of lookups) expect(lookup.filters.user_id).toBe(user!.id);
  });

  it("doesn't pass on the Steam ids it matched with, or let the answer be cached", async () => {
    jest.mocked(searchGames).mockResolvedValue([found(1, 'Hades', [1145360])] as never);

    const res = await get('?q=hades');

    expect((await res.json()).results[0]).not.toHaveProperty('steamAppIds');
    // It carries the library's current state, which the dialog saves back.
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it("says search isn't working when IGDB fails", async () => {
    jest.mocked(searchGames).mockRejectedValue(new Error('IGDB 500'));

    const res = await get('?q=hades');

    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn't working right now/);
  });

  it("says search isn't working when the library can't be read", async () => {
    jest.mocked(searchGames).mockResolvedValue([found(1, 'Hades')] as never);
    libraryError = new Error('db down');

    expect((await get('?q=hades')).status).toBe(503);
  });
});

describe("one game's details", () => {
  it.each([['abc'], ['0'], ['-4'], ['1.5']])('refuses the id "%s"', async (id) => {
    expect((await get(`?id=${id}`)).status).toBe(400);
    expect(getAddableGameDetails).not.toHaveBeenCalled();
  });

  it('returns the details, cached in the browser for a few minutes', async () => {
    const details = { igdbId: 7, name: 'Hades', header_image: 'https://images.igdb.com/a.jpg' };
    jest.mocked(getAddableGameDetails).mockResolvedValue(details as never);

    const res = await get('?id=7');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ game: details });
    expect(getAddableGameDetails).toHaveBeenCalledWith(7);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
  });

  it("says so when IGDB doesn't have the game", async () => {
    jest.mocked(getAddableGameDetails).mockResolvedValue(null);
    expect((await get('?id=7')).status).toBe(404);
  });
});

it('stops a player past the limit, without asking IGDB again', async () => {
  for (let i = 0; i < RATE_LIMITS.gameSearch.limit; i++) {
    expect((await get('?q=hades')).status).toBe(200);
  }
  jest.mocked(searchGames).mockClear();

  const res = await get('?q=hades');

  expect(res.status).toBe(429);
  expect(res.headers.get('Retry-After')).toBeTruthy();
  expect(searchGames).not.toHaveBeenCalled();
});
