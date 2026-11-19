/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/account/export/route';

let user: { id: string; email: string; created_at: string } | null;
let limited = false;
let serviceClient = true;
/** What each table holds, and a table that fails to read. */
let tables: Record<string, unknown>;
let failing: string | null = null;
/** Every filter asked for, to check each read is of the player's own rows. */
const asked: { client: string; table: string; column: string; value: unknown }[] = [];

const clientFor = (client: 'user' | 'service') => ({
  auth: { getUser: async () => ({ data: { user } }) },
  from: (table: string) => {
    const result = () =>
      failing === table
        ? { data: null, error: { message: 'boom' } }
        : { data: tables[table] ?? [], error: null };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        asked.push({ client, table, column, value });
        return query;
      },
      or: () => query,
      order: () => query,
      range: () => query,
      maybeSingle: async () => result(),
      then: (resolve: (value: unknown) => void) => resolve(result()),
    };
    return query;
  },
});

jest.mock('@/lib/supabase/server', () => ({ createClient: async () => clientFor('user') }));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => (serviceClient ? clientFor('service') : null),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({
    success: !limited,
    limit: 10,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  }),
}));

const get = (query = '') => GET(new NextRequest(`http://localhost/api/account/export${query}`));

beforeEach(() => {
  user = { id: 'user-1', email: 'player@example.com', created_at: '2026-01-26T09:00:00Z' };
  limited = false;
  serviceClient = true;
  failing = null;
  asked.length = 0;
  tables = {
    profiles: {
      steam_id: '7656',
      steam_username: 'Ankrath',
      display_name: 'mistkai',
      username: 'mist_kai',
    },
    games: [
      {
        id: 1,
        name: 'Hades',
        source: 'steam',
        platform: null,
        app_id: 1145360,
        steam_app_id: null,
        status: 'finished',
        rating: 9,
        notes: 'One more run',
        started_at: null,
        finished_at: '2026-03-20T00:00:00Z',
        dropped_at: null,
        playtime_forever: 1230,
        last_played_at: null,
        created_at: '2026-01-26T10:00:00Z',
        header_image: null,
        art_chosen: false,
      },
    ],
    playing_queue: [],
    favorite_games: [{ game_id: 1, position: 0 }],
    player_insights: [],
    shared_completions: [],
    support_tickets: [{ type: 'bug', message: 'Hello', created_at: '2026-04-01T08:00:00Z' }],
    game_events: [
      {
        game_id: 1,
        kind: 'status',
        changes: { status: ['playing', 'finished'], rating: [null, 9] },
        created_at: '2026-03-20T21:00:00Z',
      },
    ],
    game_picks: [
      {
        game_id: 1,
        kind: 'questions',
        mode: 'play',
        mood: 'relaxed',
        energy: 'low',
        time: 'short',
        attempt: 1,
        reasoning: 'Short and gentle.',
        model: 'a-model',
        outcome: 'played',
        created_at: '2026-03-01T20:00:00Z',
        answered_at: '2026-03-01T20:00:07Z',
      },
    ],
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('sends everything as a JSON file to download, never cached', async () => {
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  expect(res.headers.get('Content-Disposition')).toMatch(
    /^attachment; filename="mybacklog-data-\d{4}-\d{2}-\d{2}\.json"$/,
  );
  expect(res.headers.get('Cache-Control')).toBe('private, no-store');

  const data = JSON.parse(await res.text());
  expect(data.account).toEqual({
    email: 'player@example.com',
    name: 'mistkai',
    username: 'mist_kai',
    memberSince: '2026-01-26T09:00:00Z',
    steam: { id: '7656', username: 'Ankrath' },
  });
  expect(data.games).toHaveLength(1);
  expect(data.games[0]).toMatchObject({
    name: 'Hades',
    rating: 9,
    notes: 'One more run',
    finishedOn: '2026-03-20',
    favoritePosition: 1,
  });
  expect(data.supportMessages).toEqual([
    { type: 'bug', message: 'Hello', sentAt: '2026-04-01T08:00:00Z' },
  ]);
  expect(data.history).toEqual([
    {
      gameId: 1,
      kind: 'status',
      changes: { status: ['playing', 'finished'], rating: [null, 9] },
      at: '2026-03-20T21:00:00Z',
    },
  ]);
  expect(data.picks).toEqual([
    {
      gameId: 1,
      kind: 'questions',
      for: 'play',
      mood: 'relaxed',
      energy: 'low',
      time: 'short',
      attempt: 1,
      reason: 'Short and gentle.',
      model: 'a-model',
      outcome: 'played',
      at: '2026-03-01T20:00:00Z',
      answeredAt: '2026-03-01T20:00:07Z',
    },
  ]);
});

it('sends the games as a CSV file when asked for one', async () => {
  const res = await get('?format=csv');
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  expect(res.headers.get('Content-Disposition')).toMatch(/filename="mybacklog-games-.+\.csv"$/);
  const csv = await res.text();
  expect(csv).toContain('Name,Platform,Status,Rating,Notes');
  expect(csv).toContain('Hades,PC,Finished,9,One more run,');
});

it("reads only the player's own rows, in every table", async () => {
  await get();
  const tablesRead = asked.map((filter) => `${filter.client}:${filter.table}`).sort();
  expect(tablesRead).toEqual([
    'service:shared_completions',
    'service:support_tickets',
    'user:favorite_games',
    'user:game_events',
    'user:game_picks',
    'user:games',
    'user:player_insights',
    'user:playing_queue',
    'user:profiles',
  ]);
  // Each one by the signed-in player's id, the two read with the server's key included.
  expect(asked.every((filter) => filter.value === 'user-1')).toBe(true);
  expect(asked.find((filter) => filter.table === 'profiles')?.column).toBe('id');
  expect(
    asked.filter((filter) => filter.table !== 'profiles').every((f) => f.column === 'user_id'),
  ).toBe(true);
});

it('refuses a signed-out request, an unknown format, and one past the limit', async () => {
  expect((await get('?format=xml')).status).toBe(400);
  limited = true;
  expect((await get()).status).toBe(429);
  limited = false;
  user = null;
  expect((await get()).status).toBe(401);
  // Nothing was read for any of them.
  expect(asked).toEqual([]);
});

it('sends nothing rather than a file with a part missing', async () => {
  for (const table of ['games', 'playing_queue', 'support_tickets', 'profiles', 'game_events']) {
    failing = table;
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Couldn't prepare your data. Please try again." });
  }
  failing = null;
  serviceClient = false;
  expect((await get()).status).toBe(500);
});
