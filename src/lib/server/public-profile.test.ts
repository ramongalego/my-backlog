/**
 * @jest-environment node
 */
import { getPublicProfile } from '@/lib/server/public-profile';
import {
  loadCurrentlyPlaying,
  loadFavoriteGames,
  loadGamesList,
  loadRecentHistory,
} from '@/lib/data/loaders';
import { libraryGame as game } from '@/lib/account/test-games';

const USER_ID = '28f2ff71-0000-4000-8000-000000000001';

interface Row {
  id: string;
  username: string;
  display_name: string | null;
  steam_username: string | null;
  avatar_url: string | null;
  steam_avatar: string | null;
  is_private: boolean;
}
const mistkai: Row = {
  id: USER_ID,
  username: 'mistkai',
  display_name: 'Mist Kai',
  steam_username: 'Ankrath',
  avatar_url: null,
  steam_avatar: 'https://avatars.steamstatic.com/a_full.jpg',
  is_private: false,
};

let row: Row | null = mistkai;
let readError: { message: string } | null = null;
let serviceKey = true;
/** Names the database refuses to show to others. */
let refused: string[] = [];
let nameCheckError: { message: string } | null = null;
const asked: { table?: string; column?: string; value?: unknown; checked?: string }[] = [];

jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () =>
    serviceKey
      ? {
          from: (table: string) => ({
            select: () => ({
              eq: (column: string, value: unknown) => ({
                maybeSingle: async () => {
                  asked.push({ table, column, value });
                  return { data: readError ? null : row, error: readError };
                },
              }),
            }),
          }),
          rpc: async (name: string, args: { p_name: string }) => {
            asked.push({ checked: args.p_name });
            if (name !== 'name_allowed') throw new Error(`unexpected rpc ${name}`);
            return nameCheckError
              ? { data: null, error: nameCheckError }
              : { data: !refused.includes(args.p_name), error: null };
          },
        }
      : null,
}));
jest.mock('@/lib/data/loaders', () => ({
  loadGamesList: jest.fn(),
  loadFavoriteGames: jest.fn(),
  loadCurrentlyPlaying: jest.fn(),
  loadRecentHistory: jest.fn(),
}));
// The reuse of a read is Next's; here it only records that it was asked for.
const mockReused: string[] = [];
jest.mock('next/cache', () => ({
  unstable_cache:
    <A extends unknown[], R>(read: (...args: A) => Promise<R>) =>
    (...args: A) => {
      mockReused.push(String(args[0]));
      return read(...args);
    },
}));

const library = [
  game({
    id: 1,
    name: 'Hades',
    status: 'finished',
    rating: 9,
    finished_at: '2026-03-20T00:00:00+00:00',
    playtime_forever: 1230,
    notes: 'One more run, a private note',
  }),
  game({
    id: 2,
    name: 'Celeste',
    status: 'finished',
    rating: 10,
    finished_at: '2025-08-20T00:00:00+00:00',
    playtime_forever: 600,
    platform: 'Switch',
  }),
  game({ id: 3, name: 'Secret Shame', status: 'hidden', playtime_forever: 9000 }),
  game({ id: 4, name: 'Hollow Knight', playtime_forever: 0, platform: 'Switch' }),
  game({ id: 5, name: 'Elden Ring', source: 'manual', platform: 'PS5', playtime_forever: 120 }),
];

beforeEach(() => {
  row = mistkai;
  readError = null;
  serviceKey = true;
  refused = [];
  nameCheckError = null;
  asked.length = 0;
  mockReused.length = 0;
  jest.mocked(loadGamesList).mockReset().mockResolvedValue(library);
  jest.mocked(loadFavoriteGames).mockReset().mockResolvedValue([2, 3, 1]);
  jest.mocked(loadCurrentlyPlaying).mockReset().mockResolvedValue(null);
  jest.mocked(loadRecentHistory).mockReset().mockResolvedValue([]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.useFakeTimers({
    now: new Date('2026-11-19T12:00:00Z'),
    doNotFake: ['nextTick', 'setImmediate'],
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('is what a profile shows: the name, picture, figures, favorites and platforms', async () => {
  expect(await getPublicProfile('mistkai')).toEqual({
    username: 'mistkai',
    name: 'Mist Kai',
    avatar: 'https://avatars.steamstatic.com/a_full.jpg',
    // The hidden game counts for nothing.
    figures: { games: 4, finished: 2, finishedThisYear: 1, hours: 33, avgRating: null },
    // Two rated games have no shape to show.
    ratings: null,
    // In the order picked, without the hidden one.
    favorites: [
      { name: 'Celeste', header_image: 'https://example.com/art.jpg', rating: 10 },
      { name: 'Hades', header_image: 'https://example.com/art.jpg', rating: 9 },
    ],
    platforms: [
      { name: 'Switch', count: 2 },
      { name: 'PC', count: 1 },
      { name: 'PS5', count: 1 },
    ],
    // With no history yet: what the games themselves say was finished.
    library: { main: 'Switch', count: 3 },
    activity: [
      {
        key: '0',
        name: 'Hades',
        header_image: 'https://example.com/art.jpg',
        source: 'steam',
        platform: 'PC',
        at: '2026-03-20',
        lines: [{ kind: 'finished', rating: 9 }],
      },
      {
        key: '1',
        name: 'Celeste',
        header_image: 'https://example.com/art.jpg',
        source: 'steam',
        platform: 'Switch',
        at: '2025-08-20',
        lines: [{ kind: 'finished', rating: 10 }],
      },
    ],
  });
  expect(loadGamesList).toHaveBeenCalledWith(expect.anything(), USER_ID);
  expect(loadFavoriteGames).toHaveBeenCalledWith(expect.anything(), USER_ID);
});

it('holds nothing private: no account id, no notes, no hidden game, and not the library', async () => {
  const sent = JSON.stringify(await getPublicProfile('mistkai'));
  expect(sent).not.toContain(USER_ID);
  expect(sent).not.toContain('private note');
  expect(sent).not.toContain('Secret Shame');
  expect(sent).not.toContain('Hollow Knight');
  expect(Object.keys((await getPublicProfile('mistkai'))!).sort()).toEqual(
    [
      'activity',
      'avatar',
      'favorites',
      'figures',
      'library',
      'name',
      'platforms',
      'ratings',
      'username',
    ].sort(),
  );
});

it('says the average rating and how the ratings are spread once enough games are rated', async () => {
  const more = [7, 8, 8].map((rating, i) =>
    game({ id: 20 + i, name: `Rated ${i}`, status: 'finished', rating }),
  );
  jest.mocked(loadGamesList).mockResolvedValue([...library, ...more]);
  const profile = (await getPublicProfile('mistkai'))!;
  // 9, 10, 7, 8 and 8.
  expect(profile.figures.avgRating).toBe(8.4);
  expect(profile.ratings).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1]);
});

describe('what the player did', () => {
  const event = (
    id: number,
    game_id: number,
    kind: 'status' | 'queue' | 'note' | 'favorite' | 'playtime',
    changes: Record<string, [unknown, unknown]>,
    hour: number,
  ) => ({
    id,
    game_id,
    kind,
    changes,
    created_at: `2026-11-19T${String(hour).padStart(2, '0')}:00:00+00:00`,
  });

  it('is the highlights, newest first, read from more of the history than the Profile page takes', async () => {
    jest
      .mocked(loadRecentHistory)
      .mockResolvedValue([
        event(6, 5, 'playtime', { playtime_forever: [0, 120] }, 11),
        event(5, 4, 'status', { status: ['backlog', 'wont_play'] }, 10),
        event(4, 4, 'note', { noted: [false, true] }, 9),
        event(3, 4, 'queue', { queued: [false, true] }, 8),
        event(2, 3, 'status', { status: ['playing', 'finished'], rating: [null, 3] }, 7),
        event(1, 1, 'favorite', { favorite: [false, true] }, 6),
      ]);
    const { activity } = (await getPublicProfile('mistkai'))!;
    expect(activity.map((row) => [row.name, row.lines.map((line) => line.kind)])).toEqual([
      ['Elden Ring', ['played']],
      ['Hades', ['favorite']],
      ['Hades', ['finished']],
      ['Celeste', ['finished']],
    ]);
    expect(loadRecentHistory).toHaveBeenCalledWith(expect.anything(), USER_ID, 200);
    expect(loadCurrentlyPlaying).toHaveBeenCalledWith(expect.anything(), USER_ID);

    // The housekeeping on Hollow Knight, and anything about the hidden game, stays home.
    const sent = JSON.stringify(activity);
    expect(sent).not.toContain('Hollow Knight');
    expect(sent).not.toContain('Secret Shame');
    expect(sent).not.toContain('wont_play');
    expect(sent).not.toContain('note');
    // No game ids or event ids: a row is only what it draws.
    expect(Object.keys(activity[0]).sort()).toEqual(
      ['at', 'header_image', 'key', 'lines', 'name', 'platform', 'source'].sort(),
    );
  });

  it('says the game being played now, from when it was started', async () => {
    jest
      .mocked(loadGamesList)
      .mockResolvedValue([...library, game({ id: 6, name: 'Tunic', status: 'playing' })]);
    jest
      .mocked(loadCurrentlyPlaying)
      .mockResolvedValue({ id: 6, started_at: '2026-11-18T20:00:00+00:00' } as never);
    const { activity } = (await getPublicProfile('mistkai'))!;
    expect(activity[0]).toMatchObject({
      name: 'Tunic',
      at: '2026-11-18T20:00:00+00:00',
      lines: [{ kind: 'playing' }],
    });
  });
});

describe('the name it goes by', () => {
  it("is the Steam name without a chosen one, and the uploaded picture over Steam's", async () => {
    row = { ...mistkai, display_name: null, avatar_url: 'https://x/mine.webp' };
    expect(await getPublicProfile('mistkai')).toMatchObject({
      name: 'Ankrath',
      avatar: 'https://x/mine.webp',
    });
  });

  it('skips a name the database refuses to show: the Steam one, then the username', async () => {
    refused = ['Mist Kai'];
    expect((await getPublicProfile('mistkai'))!.name).toBe('Ankrath');
    refused = ['Mist Kai', 'Ankrath'];
    expect((await getPublicProfile('mistkai'))!.name).toBe('mistkai');
  });

  it('is the username for an account with no name at all, never anything from its email', async () => {
    row = { ...mistkai, username: 'player4821', display_name: null, steam_username: null };
    const profile = await getPublicProfile('player4821');
    expect(profile!.name).toBe('player4821');
    // Nothing to check, so nothing was asked.
    expect(asked.filter((one) => one.checked !== undefined)).toEqual([]);
  });

  it('is the username when the check itself fails: an unchecked name is not shown', async () => {
    nameCheckError = { message: 'boom' };
    expect((await getPublicProfile('mistkai'))!.name).toBe('mistkai');
    expect(console.error).toHaveBeenCalledWith('Checking a public name failed:', nameCheckError);
  });
});

describe('which profile is read', () => {
  it('is the one with that username, whatever capitals were typed', async () => {
    await getPublicProfile(' MistKai ');
    expect(asked[0]).toEqual({ table: 'profiles', column: 'username', value: 'mistkai' });
  });

  it('is none for a username nobody has', async () => {
    row = null;
    expect(await getPublicProfile('nobody')).toBeNull();
    expect(loadGamesList).not.toHaveBeenCalled();
  });

  it('is none for a profile its player made private, and nothing of it is read', async () => {
    row = { ...mistkai, is_private: true };
    expect(await getPublicProfile('mistkai')).toBeNull();
    expect(loadGamesList).not.toHaveBeenCalled();
    expect(asked.filter((one) => one.checked !== undefined)).toEqual([]);
  });

  it('is none, without asking the database, for what could not be a username', async () => {
    for (const not of ['ab', 'mist kai', 'mist.kai', "x' or 1=1", 'x'.repeat(21), '', '../admin']) {
      expect(await getPublicProfile(not)).toBeNull();
    }
    expect(asked).toEqual([]);
    expect(mockReused).toEqual([]);
  });

  it('fails, rather than saying there is no such profile, when the read fails', async () => {
    readError = { message: 'timeout' };
    await expect(getPublicProfile('mistkai')).rejects.toEqual(readError);
    serviceKey = false;
    await expect(getPublicProfile('mistkai')).rejects.toThrow(/secret key/);
  });
});

it('reuses what the library comes to, by its account, and reads the profile itself every time', async () => {
  await getPublicProfile('MistKai');
  expect(mockReused).toEqual([USER_ID]);

  // Renamed and made private since: both show at once, whatever is being reused.
  row = { ...mistkai, display_name: 'Kai' };
  expect((await getPublicProfile('mistkai'))!.name).toBe('Kai');
  expect(mockReused).toEqual([USER_ID, USER_ID]);

  row = { ...mistkai, is_private: true };
  expect(await getPublicProfile('mistkai')).toBeNull();
  expect(mockReused).toEqual([USER_ID, USER_ID]);
  expect(asked.filter((one) => one.table === 'profiles')).toHaveLength(3);
});
