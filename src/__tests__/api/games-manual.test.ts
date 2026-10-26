/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/manual/route';
import { applyStatusChange } from '@/lib/games/apply-status';
import { getGameDetails } from '@/lib/igdb/api';

const inserted: Record<string, unknown>[] = [];
const queueInserts: Record<string, unknown>[] = [];
let insertError: { code: string } | null = null;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: (table: string) => {
      const builder = {
        insert: (row: Record<string, unknown>) => {
          (table === 'games' ? inserted : queueInserts).push(row);
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        single: async () =>
          insertError ? { data: null, error: insertError } : { data: { id: 42 }, error: null },
        maybeSingle: async () => ({ data: { position: 2 }, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/igdb/api', () => ({ getGameDetails: jest.fn() }));
jest.mock('@/lib/hltb/api', () => ({ getMainStoryHours: jest.fn().mockResolvedValue(30) }));
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
  queueInserts.length = 0;
  insertError = null;
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
