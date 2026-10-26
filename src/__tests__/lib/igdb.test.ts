/**
 * @jest-environment node
 */
import { getGameDetails, pickWideArt, searchGames } from '@/lib/igdb/api';
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
  artworks: [{ image_id: 'ar1', width: 1920, height: 1080, artwork_type: 2 }],
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

describe('pickWideArt', () => {
  const art = (image_id: string, width: number, height: number, artwork_type = 1) => ({
    image_id,
    width,
    height,
    artwork_type,
  });

  it('prefers key art, then properly wide artwork', () => {
    expect(
      pickWideArt({
        artworks: [
          art('plain', 1600, 800, 1),
          art('logo', 2788, 661, 7),
          art('key', 1920, 1080, 3),
        ],
      }),
    ).toBe('key');
    expect(pickWideArt({ artworks: [art('plain', 1600, 800, 1)] })).toBe('plain');
  });

  it('skips character renders, small art and logos for a sharp screenshot', () => {
    expect(
      pickWideArt({
        artworks: [
          art('tall', 700, 1400),
          art('torso', 1340, 930),
          art('small', 400, 200, 2),
          art('logo', 2788, 661, 7),
        ],
        screenshots: [{ image_id: 'shot', width: 1280 }],
      }),
    ).toBe('shot');
  });

  it('has none when the only screenshots are small, so the box art is used', () => {
    expect(
      pickWideArt({
        artworks: [art('torso', 1260, 840)],
        screenshots: [{ image_id: '3ds', width: 640 }],
      }),
    ).toBeNull();
    expect(pickWideArt({})).toBeNull();
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
