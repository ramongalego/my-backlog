/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/sync/bulk/route';
import { MAX_BULK_APP_IDS } from '@/lib/games/sync-limits';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

type Row = Record<string, unknown>;

let user: { id: string } | null = null;
// A fresh user per test, so the in-memory limiter starts from zero.
let userCount = 0;
let cache: Row[] = [];
let games: Row[] = [];
let failRead: 'game_metadata' | 'games' | null = null;
let failWrite = false;
const writes: { filters: Record<string, unknown>; values: Row }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    // Enough of the query builder for the cache lookup, the player's rows and
    // the per-game updates.
    from: (table: 'game_metadata' | 'games') => {
      const filters: Record<string, unknown> = {};
      let values: Row | null = null;
      const matches = (row: Row) =>
        Object.entries(filters).every(([col, val]) =>
          Array.isArray(val) ? val.includes(row[col]) : row[col] === val,
        );
      const builder = {
        select: () => builder,
        update: (v: Row) => {
          values = v;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          filters[col] = vals;
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (values) {
            if (failWrite) return resolve({ data: null, error: new Error('write failed') });
            writes.push({ filters, values });
            games.filter(matches).forEach((row) => Object.assign(row, values));
            return resolve({ data: null, error: null });
          }
          if (failRead === table) return resolve({ data: null, error: new Error('read failed') });
          return resolve({
            data: (table === 'games' ? games : cache).filter(matches),
            error: null,
          });
        },
      };
      return builder;
    },
  }),
}));

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** A row of the shared cache: a game synced yesterday, with its time to beat. */
const cached = (app_id: number, overrides: Row = {}): Row => ({
  app_id,
  platform: 'PC',
  type: 'game',
  name: `Game ${app_id}`,
  genres: ['RPG'],
  categories: ['Single-player'],
  description: 'A game.',
  release_date: 'Sep 28, 2010',
  header_image: `https://cdn.example/${app_id}.jpg`,
  steam_review_score: 90,
  steam_review_count: 1000,
  steam_review_weighted: 88,
  main_story_hours: 12,
  deck_compat: 3,
  tags: ['JRPG'],
  synced_at: daysAgo(1),
  hltb_attempts: 0,
  ...overrides,
});
/** One of the player's games, as the import leaves it: not synced yet. */
const owned = (app_id: number, overrides: Row = {}): Row => ({
  user_id: user!.id,
  app_id,
  main_story_hours: null,
  metadata_synced: false,
  ...overrides,
});

const sync = async (body: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/games/sync/bulk', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, headers: res.headers, body: await res.json() };
};

beforeEach(() => {
  user = { id: `bulk-user-${++userCount}` };
  cache = [];
  games = [];
  failRead = null;
  failWrite = false;
  writes.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await sync({ appIds: [1] })).status).toBe(401);
});

it.each([
  ['a body that is not JSON', '{'],
  ['no ids', {}],
  ['an empty list', { appIds: [] }],
  ['an id that is not a number', { appIds: ['620'] }],
  ['an id too big for the database', { appIds: [2_147_483_648] }],
])('refuses %s, without reading or writing', async (_, body) => {
  expect((await sync(body)).status).toBe(400);
  expect(writes).toEqual([]);
});

it('says how many ids one request takes when given more', async () => {
  const appIds = Array.from({ length: MAX_BULK_APP_IDS + 1 }, (_, i) => i + 1);
  const res = await sync({ appIds });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe(`Maximum ${MAX_BULK_APP_IDS} app IDs per request`);
});

it("copies a cached game's details onto the player's row and leaves the rest to fetch", async () => {
  cache = [cached(620)];
  games = [owned(620), owned(730)];

  const res = await sync({ appIds: [620, 730] });

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ resolved: 1, synced: 1, remaining: [730], hltbPending: [] });
  expect(games[0]).toMatchObject({
    metadata_synced: true,
    main_story_hours: 12,
    tags: ['JRPG'],
    header_image: 'https://cdn.example/620.jpg',
  });
  // The console it's played on is the player's to set: the cache's isn't copied.
  expect(writes[0].values).not.toHaveProperty('platform');
  expect(games[1].metadata_synced).toBe(false);
});

it("only ever writes to the signed-in player's games", async () => {
  cache = [cached(620)];
  games = [owned(620), { ...owned(620), user_id: 'someone-else' }];

  await sync({ appIds: [620] });

  expect(writes).toHaveLength(1);
  expect(writes[0].filters).toEqual({ user_id: user!.id, app_id: 620 });
  expect(games[1].metadata_synced).toBe(false);
});

it("doesn't write a game that already has what the cache has", async () => {
  cache = [cached(620)];
  games = [owned(620, { metadata_synced: true, main_story_hours: 12 })];

  const res = await sync({ appIds: [620] });

  // Resolved (nothing to fetch), but not reported as changed: the browser
  // refreshes its list only for games that were.
  expect(res.body).toMatchObject({ resolved: 1, synced: 0, remaining: [] });
  expect(writes).toEqual([]);
});

it('writes a synced game again when the cache has since found its time to beat', async () => {
  cache = [cached(620, { main_story_hours: 9.5 })];
  games = [owned(620, { metadata_synced: true, main_story_hours: null })];

  const res = await sync({ appIds: [620] });

  expect(res.body).toMatchObject({ resolved: 1, synced: 1 });
  expect(games[0].main_story_hours).toBe(9.5);
});

it('uses a game that only lacks its time to beat, and asks for the time separately', async () => {
  cache = [cached(620, { main_story_hours: null })];
  games = [owned(620)];

  const res = await sync({ appIds: [620] });

  expect(res.body).toEqual({ resolved: 1, synced: 1, remaining: [], hltbPending: [620] });
  expect(games[0]).toMatchObject({ metadata_synced: true, main_story_hours: null });
});

it('leaves a game HowLongToBeat was asked about recently, without another write', async () => {
  // One miss three days back off: not due again yet.
  cache = [cached(620, { main_story_hours: null, hltb_attempts: 1, synced_at: daysAgo(1) })];
  games = [owned(620, { metadata_synced: true })];

  const res = await sync({ appIds: [620] });

  expect(res.body).toEqual({ resolved: 1, synced: 0, remaining: [], hltbPending: [] });
  expect(writes).toEqual([]);
});

it('sends a game whose cached details are too old to be fetched again', async () => {
  cache = [cached(620, { synced_at: daysAgo(400) })];
  games = [owned(620)];

  const res = await sync({ appIds: [620] });

  expect(res.body).toMatchObject({ resolved: 0, synced: 0, remaining: [620] });
  expect(writes).toEqual([]);
});

it.each([['game_metadata' as const], ['games' as const]])(
  "says so when %s can't be read, without writing",
  async (table) => {
    cache = [cached(620)];
    games = [owned(620)];
    failRead = table;

    const res = await sync({ appIds: [620] });

    expect(res.status).toBe(500);
    expect(writes).toEqual([]);
  },
);

it("says so when a game's details couldn't be saved", async () => {
  cache = [cached(620)];
  games = [owned(620)];
  failWrite = true;

  const res = await sync({ appIds: [620] });

  expect(res.status).toBe(500);
  expect(res.body).toEqual({ error: 'Failed to sync game metadata' });
});

it('stops a player past the limit', async () => {
  for (let i = 0; i < RATE_LIMITS.gameSyncBulk.limit; i++) {
    expect((await sync({ appIds: [620] })).status).toBe(200);
  }
  const res = await sync({ appIds: [620] });
  expect(res.status).toBe(429);
  expect(res.headers.get('Retry-After')).toBeTruthy();
});
