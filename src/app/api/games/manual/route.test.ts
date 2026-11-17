/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/manual/route';
import { applyStatusChange } from '@/lib/server/apply-status';
import { getGameDetails } from '@/lib/igdb/api';
import { getMainStoryHours } from '@/lib/hltb/api';
import { getStoreItemInfo } from '@/lib/steam/store-api';
import { findWideArt } from '@/lib/steamgriddb/api';

const inserted: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];
const queueInserts: Record<string, unknown>[] = [];
let insertError: { code: string } | null = null;
// The user's Steam entry for the game, if any: on Steam ('PC'), or on the
// console it was moved to before.
let steamRow: { id: number; name: string; status: string; platform: string } | null = null;
// The game added by hand before, on some console, if any.
let manualRow: { id: number; name: string; status: string } | null = null;
let alreadyQueued = false;
// The consoles the player's games are on, as saved; null when reading them fails.
let libraryConsoles: string[] | null = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
    from: (table: string) => {
      let columns = '';
      let source = '';
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
        eq: (column: string, value: unknown) => {
          if (column === 'source') source = String(value);
          return builder;
        },
        in: () => builder,
        neq: () => builder,
        order: () => builder,
        limit: () => builder,
        single: async () =>
          insertError
            ? { data: null, error: insertError }
            : { data: { id: steamRow?.id ?? manualRow?.id ?? 42 }, error: null },
        maybeSingle: async () => {
          if (table === 'games')
            return { data: source === 'manual' ? manualRow : steamRow, error: null };
          if (columns === 'game_id')
            return {
              data: alreadyQueued ? { game_id: steamRow?.id ?? manualRow?.id } : null,
              error: null,
            };
          return { data: { position: 2 }, error: null };
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            table === 'games' && columns === 'platform'
              ? libraryConsoles === null
                ? { data: null, error: { message: 'down' } }
                : { data: libraryConsoles.map((platform) => ({ platform })), error: null }
              : { error: null },
          ),
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/igdb/api', () => ({ getGameDetails: jest.fn() }));
jest.mock('@/lib/hltb/api', () => ({ getMainStoryHours: jest.fn().mockResolvedValue(30) }));
jest.mock('@/lib/steam/store-api', () => ({ getStoreItemInfo: jest.fn() }));
jest.mock('@/lib/steamgriddb/api', () => ({ findWideArt: jest.fn() }));
jest.mock('@/lib/server/apply-status', () => ({ applyStatusChange: jest.fn() }));

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
  hasKeyArt: true,
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
  manualRow = null;
  alreadyQueued = false;
  libraryConsoles = [];
  jest.mocked(getGameDetails).mockResolvedValue(details);
  jest.mocked(applyStatusChange).mockResolvedValue({ ok: true, paused: [] });
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
  // Its time is looked up with its release year, which tells a remake from
  // the original it shares a title with.
  expect(getMainStoryHours).toHaveBeenCalledWith("Fire Emblem: Fortune's Weave", 2026);
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

it("uses SteamGridDB's art when IGDB has no key art and Steam doesn't sell the game", async () => {
  jest.mocked(getStoreItemInfo).mockResolvedValue(null);
  jest.mocked(findWideArt).mockResolvedValue('https://cdn2.steamgriddb.com/grid/shield.png');
  // IGDB's key art wins when there is some.
  await post({ igdbId: 1, platform: 'Switch', status: 'backlog' });
  expect(findWideArt).not.toHaveBeenCalled();
  expect(inserted[0].header_image).toBe(details.header_image);

  // Without it, SteamGridDB is looked up by name and release year.
  jest.mocked(getGameDetails).mockResolvedValue({ ...details, hasKeyArt: false });
  await post({ igdbId: 1, platform: 'Switch 2', status: 'backlog' });
  expect(findWideArt).toHaveBeenCalledWith(details.name, 2026);
  expect(inserted[1].header_image).toBe('https://cdn2.steamgriddb.com/grid/shield.png');

  // And when it has nothing, IGDB's other art stays.
  jest.mocked(findWideArt).mockResolvedValue(null);
  await post({ igdbId: 1, platform: 'Switch Lite', status: 'backlog' });
  expect(inserted[2].header_image).toBe(details.header_image);
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
    steamRow = {
      id: 7,
      name: 'Castlevania Dominus Collection',
      status: 'backlog',
      platform: 'PC',
    };
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
    expect(body).toMatchObject({ id: 7, moved: true });
    // Already in the backlog: nothing else changes.
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it("starts the console copy at no hours when none are entered: Steam's were for PC", async () => {
    await post({ igdbId: 314944, platform: 'Switch', status: 'backlog' });
    expect(updated[0]).toEqual({
      platform: 'Switch',
      igdb_id: 314944,
      playtime_forever: 0,
      last_played_at: null,
    });
  });

  // Saved through Add game a second time, to mark it finished, say. Its hours
  // and last-played date are the console's by now, not Steam's.
  describe('and already moved to a console', () => {
    beforeEach(() => {
      steamRow = { ...steamRow!, platform: 'Switch' };
    });

    it('keeps its hours and last-played date when the hours are left blank', async () => {
      const { status, body } = await post({
        igdbId: 314944,
        platform: 'Switch',
        status: 'finished',
        date: '2026-10-20',
      });
      expect(status).toBe(200);
      expect(updated[0]).toEqual({ platform: 'Switch', igdb_id: 314944 });
      expect(body).toMatchObject({ id: 7, moved: true });
      expect(applyStatusChange).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.objectContaining({ gameId: 7, status: 'finished', finishedAt: '2026-10-20' }),
      );
    });

    it('saves the hours entered, and still leaves the last-played date', async () => {
      await post({ igdbId: 314944, platform: 'Switch', status: 'backlog', hoursPlayed: 12 });
      expect(updated[0]).toEqual({ platform: 'Switch', igdb_id: 314944, playtime_forever: 720 });
    });

    it('saves 0 hours when 0 is what was entered', async () => {
      await post({ igdbId: 314944, platform: 'Switch', status: 'backlog', hoursPlayed: 0 });
      expect(updated[0]).toEqual({ platform: 'Switch', igdb_id: 314944, playtime_forever: 0 });
    });

    it('keeps them when it moves on to another console', async () => {
      await post({ igdbId: 314944, platform: 'PS5', status: 'backlog' });
      expect(updated[0]).toEqual({ platform: 'PS5', igdb_id: 314944 });
    });
  });

  it('starts it when you pick Playing', async () => {
    await post({ igdbId: 314944, platform: 'Switch', status: 'playing' });
    expect(applyStatusChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ gameId: 7, status: 'playing', pausePlaying: true }),
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

describe('a game you already added by hand', () => {
  beforeEach(() => {
    manualRow = { id: 9, name: 'Hades', status: 'backlog' };
  });

  it('moves it to the new console instead of adding it twice', async () => {
    const { status, body } = await post({ igdbId: 1, platform: 'PS5', status: 'backlog' });
    expect(status).toBe(200);
    expect(inserted).toHaveLength(0);
    expect(updated[0]).toEqual({ platform: 'PS5' });
    expect(body).toMatchObject({ id: 9, name: 'Hades', moved: true });
    // Same status as before: nothing to change.
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('keeps its hours unless you enter new ones', async () => {
    await post({ igdbId: 1, platform: 'PS5', status: 'backlog', hoursPlayed: 4 });
    expect(updated[0]).toEqual({ platform: 'PS5', playtime_forever: 240 });
  });

  it('saves a new status, like finishing it', async () => {
    await post({ igdbId: 1, platform: 'Switch', status: 'finished', date: '2026-10-20' });
    expect(applyStatusChange).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ gameId: 9, status: 'finished', finishedAt: '2026-10-20' }),
    );
  });
});

describe('art picked before adding', () => {
  const PICK = 'https://cdn2.steamgriddb.com/grid/abc.png';
  const add = (art: string) => post({ igdbId: 1, platform: 'Switch 2', status: 'backlog', art });

  it("is saved as the player's choice, with the game's own art behind it", async () => {
    expect((await add(PICK)).status).toBe(200);
    expect(inserted[0]).toMatchObject({
      header_image: PICK,
      art_chosen: true,
      default_header_image: details.header_image,
    });
  });

  it("is no choice at all when it's the game's own art", async () => {
    expect((await add(details.header_image)).status).toBe(200);
    expect(inserted[0]).toMatchObject({
      header_image: details.header_image,
      art_chosen: false,
      default_header_image: null,
    });
  });

  it('must be one of SteamGridDB’s images, or nothing is added', async () => {
    const { status, body } = await add('https://example.com/anything.png');
    expect(status).toBe(400);
    expect(body.error).toBe('That image can’t be used');
    expect(inserted).toEqual([]);
    expect(getMainStoryHours).not.toHaveBeenCalled();
  });

  it('leaves a game already in the library with the art it has', async () => {
    manualRow = { id: 5, name: details.name, status: 'backlog' };
    expect((await add(PICK)).status).toBe(200);
    expect(inserted).toEqual([]);
    expect(updated.some((row) => 'header_image' in row || 'art_chosen' in row)).toBe(false);
  });
});

describe('when its time to beat was last looked up', () => {
  const add = () => post({ igdbId: 1, platform: 'Switch 2', status: 'backlog' });

  it('is saved with a game added with a time, so a new release waits its week for the next check', async () => {
    const before = Date.now();
    await add();
    const checked = Date.parse(String(inserted[0].hltb_checked_at));
    expect(checked).toBeGreaterThanOrEqual(before);
    expect(checked).toBeLessThanOrEqual(Date.now());
  });

  it('is left empty for a game added without one, so it is tried again at the next refresh', async () => {
    jest.mocked(getMainStoryHours).mockResolvedValueOnce(null);
    await add();
    expect(inserted[0].main_story_hours).toBeNull();
    expect('hltb_checked_at' in inserted[0]).toBe(false);
  });
});

describe('a console typed by hand', () => {
  const add = (platform: string) => post({ igdbId: 1, platform, status: 'backlog' });

  it.each([
    ['switch 2', 'Switch 2'],
    ['Nintendo Switch 2', 'Switch 2'],
    ['  Switch   2 ', 'Switch 2'],
    ['ps5', 'PS5'],
  ])('is saved as the console the app knows: "%s" is %s', async (typed, saved) => {
    expect((await add(typed)).status).toBe(200);
    expect(inserted[0].platform).toBe(saved);
  });

  it("is saved as the game's own console, spelled the app's way, when IGDB lists one with no short name", async () => {
    jest.mocked(getGameDetails).mockResolvedValue({ ...details, platforms: ['Xbox One'] });
    await add('xbox one');
    expect(inserted[0].platform).toBe('Xbox One');
  });

  it('is saved as the player spelled it for another game', async () => {
    libraryConsoles = ['Commodore 64', 'Switch 2'];
    await add('commodore 64');
    expect(inserted[0].platform).toBe('Commodore 64');
  });

  it('is saved as typed, tidied, when nothing knows it', async () => {
    await add('  Commodore   64 ');
    expect(inserted[0].platform).toBe('Commodore 64');
  });

  it('is saved as typed when the library cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    libraryConsoles = null;
    expect((await add('commodore 64')).status).toBe(200);
    expect(inserted[0].platform).toBe('commodore 64');
    jest.restoreAllMocks();
  });

  it('is refused as PC, typed any way, for a game that is already on Steam', async () => {
    jest.mocked(getGameDetails).mockResolvedValue({ ...details, steamAppIds: [2369900] });
    steamRow = { id: 7, name: 'Fire Emblem', status: 'backlog', platform: 'PC' };
    expect((await add('pc')).status).toBe(400);
    expect(updated).toEqual([]);
  });
});
