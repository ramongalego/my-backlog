/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/manual/route';
import { applyStatusChange } from '@/lib/games/apply-status';
import { getGameDetails } from '@/lib/igdb/api';
import { getStoreItemInfo } from '@/lib/steam/store-api';

const inserted: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];
const queueInserts: Record<string, unknown>[] = [];
let insertError: { code: string } | null = null;
// The user's Steam entry for the game, if any.
let steamRow: { id: number; name: string; status: string } | null = null;
let alreadyQueued = false;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: (table: string) => {
      let columns = '';
      const builder = {
        insert: (row: Record<string, unknown>) => {
          (table === 'games' ? inserted : queueInserts).push(row);
          return builder;
        },
        update: (row: Record<string, unknown>) => {
          updated.push(row);
          return builder;
        },
        select: (cols = '') => {
          columns = cols;
          return builder;
        },
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        single: async () =>
          insertError
            ? { data: null, error: insertError }
            : { data: { id: steamRow?.id ?? 42 }, error: null },
        maybeSingle: async () => {
          if (table === 'games') return { data: steamRow, error: null };
          if (columns === 'game_id')
            return { data: alreadyQueued ? { game_id: steamRow?.id } : null, error: null };
          return { data: { position: 2 }, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/igdb/api', () => ({ getGameDetails: jest.fn() }));
jest.mock('@/lib/hltb/api', () => ({ getMainStoryHours: jest.fn().mockResolvedValue(30) }));
jest.mock('@/lib/steam/store-api', () => ({ getStoreItemInfo: jest.fn() }));
jest.mock('@/lib/games/apply-status', () => ({ applyStatusChange: jest.fn() }));

const details = {
  name: "Fire Emblem: Fortune's Weave",
  platforms: ['Nintendo Switch 2'],
  genres: ['Tactical'],
  tags: ['Tactical', 'RPG'],
  categories: ['Single-player'],
  description: null,
  release_date: 'Mar 1, 2026',
  header_image: 'https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg',
  steamAppIds: [] as number[],
  critic_score: 92,
  critic_count: 6,
};

const post = async (body: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/games/manual', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
  inserted.length = 0;
  updated.length = 0;
  queueInserts.length = 0;
  insertError = null;
  steamRow = null;
  alreadyQueued = false;
  jest.mocked(getGameDetails).mockResolvedValue(details);
  jest.mocked(applyStatusChange).mockResolvedValue({ ok: true });
});

it('adds the game with its IGDB details, console and hours', async () => {
  const { status } = await post({
    igdbId: 1,
    platform: 'Switch 2',
    status: 'backlog',
    hoursPlayed: 2.5,
  });
  expect(status).toBe(200);
  expect(inserted[0]).toMatchObject({
    source: 'manual',
    igdb_id: 1,
    platform: 'Switch 2',
    name: "Fire Emblem: Fortune's Weave",
    main_story_hours: 30,
    playtime_forever: 150,
    status: 'backlog',
  });
  expect(applyStatusChange).not.toHaveBeenCalled();
});

it("uses Steam's art, tags and reviews for a game Steam also sells, else IGDB's", async () => {
  jest.mocked(getGameDetails).mockResolvedValue({ ...details, steamAppIds: [2161700] });
  jest.mocked(getStoreItemInfo).mockResolvedValue({
    tags: ['JRPG', 'Anime', 'RPG'],
    headerImage2x: 'https://steam/header_2x.jpg',
    headerImage: 'https://steam/header.jpg',
    reviews: { score: 92, count: 30000 },
  });
  await post({ igdbId: 1, platform: 'PS5', status: 'backlog' });
  expect(getStoreItemInfo).toHaveBeenCalledWith(2161700);
  expect(inserted[0]).toMatchObject({
    tags: ['JRPG', 'Anime', 'RPG'],
    header_image: 'https://steam/header_2x.jpg',
    steam_app_id: 2161700,
    steam_review_score: 92,
    steam_review_count: 30000,
  });
  // Kept apart from app_id, which marks a game in your Steam library.
  expect(inserted[0].app_id).toBeUndefined();

  // Steam unavailable: still added, with IGDB's.
  jest.mocked(getStoreItemInfo).mockResolvedValue(null);
  await post({ igdbId: 1, platform: 'PS4', status: 'backlog' });
  expect(inserted[1]).toMatchObject({ tags: details.tags, header_image: details.header_image });
});

it('logs a game you already finished, with its date, rating and notes', async () => {
  await post({
    igdbId: 1,
    platform: 'Switch 2',
    status: 'finished',
    date: '2026-10-20',
    rating: 9,
    notes: 'Loved it',
  });
  expect(applyStatusChange).toHaveBeenCalledWith(expect.anything(), expect.any(String), {
    gameId: 42,
    status: 'finished',
    finishedAt: '2026-10-20',
    notes: 'Loved it',
    rating: 9,
  });
});

it('puts a queued game at the end of the queue', async () => {
  await post({ igdbId: 1, platform: 'Switch 2', status: 'queue' });
  expect(queueInserts[0]).toMatchObject({ game_id: 42, position: 3 });
});

it('refuses the same game twice on the same console', async () => {
  insertError = { code: '23505' };
  const { status, body } = await post({ igdbId: 1, platform: 'Switch 2', status: 'backlog' });
  expect(status).toBe(409);
  expect(body.error).toBe("It's already in your library on Switch 2");
});

it('rejects a rating outside 0-10', async () => {
  const { status } = await post({
    igdbId: 1,
    platform: 'Switch 2',
    status: 'finished',
    rating: 11,
  });
  expect(status).toBe(400);
});

describe('a game you own on Steam', () => {
  beforeEach(() => {
    jest.mocked(getGameDetails).mockResolvedValue({
      ...details,
      name: 'Castlevania Dominus Collection',
      steamAppIds: [2369900],
    });
    steamRow = { id: 7, name: 'Castlevania Dominus Collection', status: 'backlog' };
  });

  it('moves your Steam entry to the console instead of adding it twice', async () => {
    const { status, body } = await post({
      igdbId: 314944,
      platform: 'Switch',
      status: 'backlog',
      hoursPlayed: 3,
    });
    expect(status).toBe(200);
    expect(inserted).toHaveLength(0);
    expect(updated[0]).toEqual({
      platform: 'Switch',
      igdb_id: 314944,
      playtime_forever: 180,
      // Steam's last-played date was for the PC copy.
      last_played_at: null,
    });
    expect(body).toMatchObject({ id: 7, movedFromSteam: true });
    // Already in the backlog: nothing else changes.
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('starts it when you pick Playing', async () => {
    await post({ igdbId: 314944, platform: 'Switch', status: 'playing' });
    expect(applyStatusChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ gameId: 7, status: 'playing' }),
    );
  });

  it('refuses PC: that is where it already is', async () => {
    const { status, body } = await post({ igdbId: 314944, platform: 'PC', status: 'backlog' });
    expect(status).toBe(400);
    expect(body.error).toMatch(/already in your Steam library/);
    expect(updated).toHaveLength(0);
  });

  it("doesn't queue it twice", async () => {
    alreadyQueued = true;
    await post({ igdbId: 314944, platform: 'Switch', status: 'queue' });
    expect(queueInserts).toHaveLength(0);
  });
});
