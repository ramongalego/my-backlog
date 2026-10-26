/**
 * @jest-environment node
 */
import { getGameDetails, searchGames } from '@/lib/igdb/api';
import { isBoxArt } from '@/lib/igdb/images';

process.env.IGDB_CLIENT_ID = 'client';
process.env.IGDB_CLIENT_SECRET = 'secret';

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

let games: unknown[] = [];
const requests: { url: string; body?: string }[] = [];

beforeEach(() => {
  requests.length = 0;
  global.fetch = jest.fn((url: string | URL, init?: RequestInit) => {
    requests.push({ url: String(url), body: init?.body as string | undefined });
    if (String(url).startsWith('https://id.twitch.tv'))
      return respond({ access_token: 'token', expires_in: 5_000_000 });
    return respond(games);
  }) as unknown as typeof fetch;
});

const mkGame = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  name: 'Xenoblade Chronicles X',
  first_release_date: 1742515200, // 21 Mar 2025
  platforms: [{ name: 'Nintendo Switch' }],
  cover: { image_id: 'co1' },
  artworks: [{ image_id: 'ar1' }],
  genres: [{ name: 'Role-playing (RPG)' }, { name: 'Adventure' }],
  themes: [{ name: 'Science fiction' }, { name: 'Open world' }],
  game_modes: [{ name: 'Single player' }, { name: 'Multiplayer' }],
  summary: 'Explore Mira.',
  ...extra,
});

describe('getGameDetails', () => {
  it("maps IGDB's game into the games table's fields, in Steam's words", async () => {
    games = [mkGame()];
    expect(await getGameDetails(7)).toEqual({
      name: 'Xenoblade Chronicles X',
      platforms: ['Nintendo Switch'],
      genres: ['Role-playing (RPG)', 'Adventure'],
      tags: ['RPG', 'Adventure', 'Sci-fi', 'Open World'],
      categories: ['Single-player', 'Multi-player'],
      description: 'Explore Mira.',
      release_date: 'Mar 21, 2025',
      header_image: 'https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg',
    });
  });

  it('falls back to the box art when there is no wide artwork', async () => {
    games = [mkGame({ artworks: undefined })];
    const details = await getGameDetails(7);
    expect(details?.header_image).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
    );
    expect(isBoxArt(details?.header_image)).toBe(true);
  });

  it('returns null for an unknown game', async () => {
    games = [];
    expect(await getGameDetails(999)).toBeNull();
  });
});

describe('searchGames', () => {
  it('keeps quotes out of the query and returns compact results', async () => {
    games = [mkGame()];
    const results = await searchGames('Xeno"blade');
    expect(requests.at(-1)?.body).toContain('search "Xeno blade";');
    expect(results).toEqual([
      {
        igdbId: 7,
        name: 'Xenoblade Chronicles X',
        year: 2025,
        cover: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg',
        platforms: ['Nintendo Switch'],
      },
    ]);
  });

  it('reuses the access token between requests', async () => {
    games = [];
    await searchGames('a game');
    await searchGames('another');
    expect(requests.filter((r) => r.url.startsWith('https://id.twitch.tv'))).toHaveLength(0);
  });
});

it('tells box art from wide art', () => {
  expect(isBoxArt('https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg')).toBe(true);
  expect(isBoxArt('https://images.igdb.com/igdb/image/upload/t_1080p/ar1.jpg')).toBe(false);
  expect(isBoxArt('https://shared.steamstatic.com/header.jpg')).toBe(false);
  expect(isBoxArt(null)).toBe(false);
});
