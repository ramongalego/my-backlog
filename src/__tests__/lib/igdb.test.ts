/**
 * @jest-environment node
 */
import {
  getCriticScoresBySteamId,
  getGameDetails,
  igdbTags,
  pickWideArt,
  searchGames,
} from '@/lib/igdb/api';
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
  aggregated_rating: 81.6,
  aggregated_rating_count: 9,
  external_games: [
    { uid: '9P07H5JQ4R5Q', external_game_source: 11 },
    { uid: '2369900', external_game_source: 1 },
  ],
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
      // Its Steam listing, to recognise it in your Steam library.
      steamAppIds: [2369900],
      // Critics' average, rounded, and how many reviews it's from.
      critic_score: 82,
      critic_count: 9,
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

  it("finds the Steam listing on a port when the game hasn't one of its own", async () => {
    // Persona 4 Golden: the Vita game, with its PC release as a separate port.
    const steam = (uid: string) => ({ uid, external_game_source: 1 });
    games = [
      mkGame({
        external_games: [{ uid: 'PCSE00120', external_game_source: 36 }],
        ports: [{ external_games: [steam('1113000')] }],
      }),
    ];
    expect((await getGameDetails(7))?.steamAppIds).toEqual([1113000]);

    // An edition of a game on Steam is on Steam too.
    games = [mkGame({ external_games: [], version_parent: { external_games: [steam('42')] } })];
    expect((await getGameDetails(7))?.steamAppIds).toEqual([42]);

    // Its own listing wins over a port's.
    games = [mkGame({ ports: [{ external_games: [steam('1113000')] }] })];
    expect((await getGameDetails(7))?.steamAppIds).toEqual([2369900]);
  });
});

describe('igdbTags', () => {
  const rpg = [{ name: 'Role-playing (RPG)' }];
  const japanese = [{ developer: true, company: { country: 392 } }];

  it('tags an RPG made in Japan as a JRPG', () => {
    expect(igdbTags({ genres: rpg, involved_companies: japanese })).toEqual(['RPG', 'JRPG']);
    // Not for other genres from Japan, or for a Japanese publisher of a Western RPG.
    expect(igdbTags({ genres: [{ name: 'Adventure' }], involved_companies: japanese })).toEqual([
      'Adventure',
    ]);
    expect(
      igdbTags({
        genres: rpg,
        involved_companies: [
          { developer: true, company: { country: 840 } },
          { developer: false, company: { country: 392 } },
        ],
      }),
    ).toEqual(['RPG']);
  });

  it('adds only the keywords that match a Steam tag, after genres and themes', () => {
    expect(
      igdbTags({
        genres: rpg,
        themes: [{ name: 'Fantasy' }],
        keywords: [{ name: 'Anime' }, { name: 'dog' }, { name: 'jrpg' }, { name: 'tactical rpg' }],
      }),
    ).toEqual(['RPG', 'Fantasy', 'Anime', 'JRPG', 'Tactical RPG']);
  });
});

describe('pickWideArt', () => {
  const art = (image_id: string, width: number, height: number, artwork_type = 1) => ({
    image_id,
    width,
    height,
    artwork_type,
  });

  it('prefers key art with its logo, then without, then wide artwork', () => {
    const keyArt = [art('key', 1920, 620, 2), art('with logo', 1920, 1080, 3)];
    const plain = art('plain', 1260, 840, 1);
    expect(pickWideArt({ artworks: [plain, art('logo', 2788, 661, 7), ...keyArt] })).toBe(
      'with logo',
    );
    expect(pickWideArt({ artworks: [plain, keyArt[0]] })).toBe('key');
    expect(pickWideArt({ artworks: [plain] })).toBe('plain');
  });

  it("skips key art with a logo that's too square to crop without cutting the logo", () => {
    expect(
      pickWideArt({ artworks: [art('square logo', 2000, 1302, 3), art('key', 1920, 1080, 2)] }),
    ).toBe('key');
  });

  it('picks the one closest to the header shape among several of the same type', () => {
    // IGDB lists them in no particular order; the least cropped wins.
    expect(
      pickWideArt({
        artworks: [
          art('16:9', 1920, 1080, 2),
          art('ultrawide', 3840, 1240, 2),
          art('2:1', 1920, 960, 2),
        ],
      }),
    ).toBe('2:1');
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
        artworks: [art('torso', 1340, 930)],
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
        steamAppIds: [2369900],
      },
    ]);
  });

  it('finds collections, listed after the games themselves', async () => {
    games = [
      mkGame({ id: 1, name: 'Castlevania Dominus Collection', game_type: 3 }),
      mkGame({ id: 2, name: 'Castlevania', game_type: 0 }),
    ];
    const results = await searchGames('castlevania');
    expect(requests.at(-1)?.body).toContain('game_type = (0,3,');
    expect(results.map((r) => r.name)).toEqual(['Castlevania', 'Castlevania Dominus Collection']);
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

describe('getCriticScoresBySteamId', () => {
  it('matches Steam ids, keeping the entry more critics reviewed and skipping unrated ones', async () => {
    games = [
      { uid: '10', game: { aggregated_rating: 81.4, aggregated_rating_count: 2 } },
      // The same Steam listing on a second IGDB entry, with more reviews.
      { uid: '10', game: { aggregated_rating: 86.6, aggregated_rating_count: 9 } },
      { uid: '20', game: {} },
    ];
    const scores = await getCriticScoresBySteamId([10, 20, 30]);
    expect([...scores]).toEqual([[10, { critic_score: 87, critic_count: 9 }]]);
    expect(requests.at(-1)?.body).toContain('uid = ("10","20","30")');
  });

  it("uses the game's score for an edition critics barely reviewed", async () => {
    // Steam sells the Game of the Year edition; critics reviewed the game.
    games = [
      {
        uid: '200260',
        game: {
          aggregated_rating: 94,
          aggregated_rating_count: 1,
          version_parent: { aggregated_rating: 91.2, aggregated_rating_count: 10 },
        },
      },
    ];
    expect((await getCriticScoresBySteamId([200260])).get(200260)).toEqual({
      critic_score: 91,
      critic_count: 10,
    });
  });
});
