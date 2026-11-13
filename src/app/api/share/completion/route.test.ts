/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/share/completion/route';

type Row = Record<string, unknown>;

let user: { id: string } | null = { id: 'user-1' };
// The player's own game with that id, and the game they're playing now.
let game: Row | null = null;
let playing: { name: string; header_image: string | null } | null = null;
const inserted: Row[] = [];

// ESM-only, which Jest can't load here: the id itself isn't what's tested.
jest.mock('nanoid', () => ({ nanoid: () => 'share-id' }));
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      // The two reads differ by what they select: the finished game's fields, or
      // the playing game's name and art.
      select: (columns: string) => {
        const result = { data: columns === 'name, header_image' ? playing : game, error: null };
        const query = {
          eq: () => query,
          neq: () => query,
          limit: () => query,
          maybeSingle: async () => result,
        };
        return query;
      },
    }),
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      insert: async (row: Row) => (inserted.push(row), { error: null }),
    }),
  }),
}));
jest.mock('@/lib/server/completion-counts', () => ({
  fetchCompletionCounts: async () => ({ gamesFinished: 41, totalGames: 208 }),
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

const finished = (overrides: Row = {}): Row => ({
  name: 'Pokémon Platinum',
  header_image: 'https://cdn2.steamgriddb.com/grid/abc.png',
  playtime_forever: 2400,
  main_story_hours: 32,
  rating: 9,
  status: 'finished',
  ...overrides,
});

beforeEach(() => {
  user = { id: 'user-1' };
  game = finished();
  playing = { name: 'Celeste', header_image: 'https://cdn.akamai.steamstatic.com/celeste.jpg' };
  inserted.length = 0;
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await share({ gameId: 7 })).status).toBe(401);
});

it.each([
  ['no game id', {}],
  ['a game id that is not a number', { gameId: 'seven' }],
])('refuses %s', async (_, body) => {
  expect((await share(body)).status).toBe(400);
  expect(inserted).toEqual([]);
});

it('builds the page from the finished game, not from anything the browser sends', async () => {
  const res = await share({
    gameId: 7,
    // What the route used to trust. None of it is read any more.
    gameName: 'Anything I like',
    nextGame: 'Any text',
    headerImage: 'https://example.com/a.jpg',
    gamesFinished: 9999,
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ id: 'share-id', url: '/share/completion/share-id' });
  expect(inserted).toEqual([
    {
      id: 'share-id',
      user_id: 'user-1',
      game_name: 'Pokémon Platinum',
      header_image: 'https://cdn2.steamgriddb.com/grid/abc.png',
      playtime_minutes: 2400,
      main_story_hours: 32,
      rating: 9,
      games_finished: 41,
      total_games: 208,
      backlog_hours_removed: 32,
      next_game: 'Celeste',
      next_game_image: 'https://cdn.akamai.steamstatic.com/celeste.jpg',
    },
  ]);
});

it("doesn't share a game that isn't the player's, or isn't finished", async () => {
  game = null;
  expect((await share({ gameId: 7 })).status).toBe(404);

  game = finished({ status: 'backlog' });
  expect((await share({ gameId: 7 })).status).toBe(404);
  expect(inserted).toEqual([]);
});

it('leaves out what the game has none of: a rating, a time to beat, a next game', async () => {
  game = finished({ rating: null, main_story_hours: 0, playtime_forever: null });
  playing = null;

  expect((await share({ gameId: 7 })).status).toBe(200);
  expect(inserted[0]).toMatchObject({
    rating: null,
    main_story_hours: null,
    backlog_hours_removed: null,
    playtime_minutes: 0,
    next_game: null,
    next_game_image: null,
  });
});

it('still shares, without the art, when the art is from anywhere but a game-art host', async () => {
  game = finished({ header_image: 'https://example.com/a.jpg' });

  expect((await share({ gameId: 7 })).status).toBe(200);
  expect(inserted[0]).toMatchObject({ game_name: 'Pokémon Platinum', header_image: null });
});

it("names the next game without its art when that art isn't from a game-art host", async () => {
  playing = { name: 'Celeste', header_image: 'https://example.com/celeste.jpg' };

  expect((await share({ gameId: 7 })).status).toBe(200);
  expect(inserted[0]).toMatchObject({ next_game: 'Celeste', next_game_image: null });
});
