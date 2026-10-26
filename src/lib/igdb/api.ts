// IGDB (Twitch's game database), for games added by hand. Server only: it
// uses the app's Twitch credentials.
import { getIgdbCredentials } from '@/lib/env.server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API_URL = 'https://api.igdb.com/v4';
const IMAGE_URL = 'https://images.igdb.com/igdb/image/upload';
const TIMEOUT_MS = 8000;

// Main games, their re-releases and bundles: no DLC, mods, episodes or updates.
// 0 main game, 3 bundle, 4 standalone expansion, 8 remake, 9 remaster,
// 10 expanded game, 11 port.
const GAME_TYPES = '(0,3,4,8,9,10,11)';
// Bundles include collections sold as one game (Castlevania Dominus
// Collection), but also "Game + Expansion Pass" store bundles, so they're
// listed after the games themselves.
const BUNDLE = 3;
const SEARCH_LIMIT = 12;

let token: { value: string; expiresAt: number } | null = null;

/** An app access token, cached until shortly before it expires (about 60 days). */
async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const { clientId, clientSecret } = getIgdbCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetchWithTimeout(`${TOKEN_URL}?${params}`, { method: 'POST' }, TIMEOUT_MS);
  if (!res.ok) throw new Error(`IGDB token request failed: HTTP ${res.status}`);
  const data: { access_token: string; expires_in: number } = await res.json();
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 3600) * 1000 };
  return token.value;
}

async function query<T>(endpoint: string, body: string): Promise<T[]> {
  const send = async () =>
    fetchWithTimeout(
      `${API_URL}/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Client-ID': getIgdbCredentials().clientId,
          Authorization: `Bearer ${await accessToken()}`,
        },
        body,
      },
      TIMEOUT_MS,
    );
  let res = await send();
  // A token revoked early: get a new one and try once more.
  if (res.status === 401) {
    token = null;
    res = await send();
  }
  if (!res.ok) throw new Error(`IGDB ${endpoint} failed: HTTP ${res.status}`);
  return res.json();
}

/** Quotes text for an Apicalypse query. */
const quoted = (text: string) => `"${text.replace(/["\\]/g, ' ')}"`;

interface IgdbImage {
  image_id: string;
  width?: number;
  height?: number;
  artwork_type?: number;
}

interface IgdbGame {
  id: number;
  name: string;
  game_type?: number;
  first_release_date?: number;
  platforms?: { name: string }[];
  cover?: { image_id: string };
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  genres?: { name: string }[];
  themes?: { name: string }[];
  game_modes?: { name: string }[];
  keywords?: { name: string }[];
  involved_companies?: { developer?: boolean; company?: { country?: number } }[];
  summary?: string;
  external_games?: { uid?: string; external_game_source?: number }[];
}

// IGDB's id for Steam among a game's store listings (external games).
const STEAM_SOURCE = 1;
const EXTERNAL_FIELDS = 'external_games.uid, external_games.external_game_source';

/** The game's Steam app ids, to recognise a game you already own on Steam. */
function steamAppIds(game: Pick<IgdbGame, 'external_games'>): number[] {
  return (game.external_games ?? []).flatMap((e) => {
    const appId = Number(e.uid);
    return e.external_game_source === STEAM_SOURCE && Number.isInteger(appId) && appId > 0
      ? [appId]
      : [];
  });
}

export interface GameSearchResult {
  igdbId: number;
  name: string;
  year: number | null;
  cover: string | null;
  platforms: string[];
  steamAppIds: number[];
}

export function coverUrl(imageId: string) {
  return `${IMAGE_URL}/t_cover_big/${imageId}.jpg`;
}

/** Wide art (artwork or screenshot) at full HD; next/image resizes it for each use. */
export function artworkUrl(imageId: string) {
  return `${IMAGE_URL}/t_1080p/${imageId}.jpg`;
}

// IGDB's artwork types that work as a game's header, best first, with how wide
// each has to be. Key art with its logo is the publisher's main promotional
// image, the one a store page leads with, like the Steam header every Steam
// game here uses; it has to be wide enough (16:10) that cropping to the header
// shape keeps the logo. Key art without a logo is often an alternate or a
// single character, so it comes second. Plain artwork on older games is often
// a single character render, which crops to a torso unless it's at least 3:2.
// Logos, covers, icons, concept art and infographics never work.
const HEADER_ARTWORK: { type: number; minRatio: number }[] = [
  { type: 3, minRatio: 1.6 },
  { type: 2, minRatio: 1.3 },
  { type: 1, minRatio: 1.5 },
  { type: 15, minRatio: 1.5 },
];
// The shape every game image is shown at (Steam's 460×215 header).
const HEADER_RATIO = 460 / 215;
const MIN_HEADER_WIDTH = 800;
// Handheld screenshots (3DS at 400x240, DS at 256x192) are too small to fill
// the header sharply; the box art looks better.
const MIN_SCREENSHOT_WIDTH = 1280;

/**
 * The game's wide art, as an IGDB image id: its best key art or wide artwork,
 * else its first sharp screenshot, else none, and the box art is used instead
 * (on a blurred copy of itself). Of several of the best type, the one closest
 * to the header's shape, so the least of it is cropped away (IGDB lists them
 * in no particular order).
 */
export function pickWideArt(game: Pick<IgdbGame, 'artworks' | 'screenshots'>): string | null {
  const rank = (a: IgdbImage) => HEADER_ARTWORK.findIndex((h) => h.type === (a.artwork_type ?? 1));
  // How far the art is from the header's shape, either way (2:1 and 9:4 are as far).
  const misfit = (a: IgdbImage) => Math.abs(Math.log(a.width! / a.height! / HEADER_RATIO));
  const best = (game.artworks ?? [])
    .filter(
      (a) =>
        rank(a) !== -1 &&
        !!a.width &&
        !!a.height &&
        a.width >= MIN_HEADER_WIDTH &&
        a.width / a.height >= HEADER_ARTWORK[rank(a)].minRatio,
    )
    .sort((a, b) => rank(a) - rank(b) || misfit(a) - misfit(b))[0];
  if (best) return best.image_id;
  const shot = game.screenshots?.[0];
  return shot && (shot.width ?? 0) >= MIN_SCREENSHOT_WIDTH ? shot.image_id : null;
}

export async function searchGames(text: string): Promise<GameSearchResult[]> {
  const games = await query<IgdbGame>(
    'games',
    `search ${quoted(text)}; fields name, game_type, first_release_date, platforms.name, cover.image_id, ${EXTERNAL_FIELDS}; where game_type = ${GAME_TYPES} & version_parent = null; limit 20;`,
  );
  const ordered = [
    ...games.filter((g) => g.game_type !== BUNDLE),
    ...games.filter((g) => g.game_type === BUNDLE),
  ].slice(0, SEARCH_LIMIT);
  return ordered.map((g) => ({
    igdbId: g.id,
    name: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    cover: g.cover ? coverUrl(g.cover.image_id) : null,
    platforms: (g.platforms ?? []).map((p) => p.name),
    steamAppIds: steamAppIds(g),
  }));
}

// IGDB's genre and theme names, in the words Steam tags use, so manual games
// share a vocabulary with the rest of the library (similarity, Pick My Game).
const TAG_NAMES: Record<string, string[]> = {
  'Role-playing (RPG)': ['RPG'],
  "Hack and slash/Beat 'em up": ['Hack and Slash', "Beat 'em up"],
  'Turn-based strategy (TBS)': ['Turn-Based Strategy'],
  'Real Time Strategy (RTS)': ['RTS'],
  'Point-and-click': ['Point & Click'],
  Platform: ['Platformer'],
  Simulator: ['Simulation'],
  Sport: ['Sports'],
  'Card & Board Game': ['Card Game', 'Board Game'],
  'Science fiction': ['Sci-fi'],
  'Open world': ['Open World'],
  'Visual Novel': ['Visual Novel'],
  'Quiz/Trivia': ['Trivia'],
  '4X (explore, expand, exploit, and exterminate)': ['4X'],
  Tactical: ['Tactical'],
  Warfare: ['War'],
};

// IGDB's keywords are added by anyone and patchy (one game has thirty, the
// next none, or junk), so only these, which mean what the Steam tag means.
const KEYWORD_TAGS: Record<string, string> = {
  jrpg: 'JRPG',
  'tactical rpg': 'Tactical RPG',
  'party-based rpg': 'Party-Based RPG',
  crpg: 'CRPG',
  'turn-based combat': 'Turn-Based Combat',
  'turn-based rpg': 'Turn-Based Combat',
  'turn-based tactics': 'Turn-Based Tactics',
  'dungeon crawler': 'Dungeon Crawler',
  metroidvania: 'Metroidvania',
  roguelike: 'Roguelike',
  roguelite: 'Roguelite',
  soulslike: 'Souls-like',
  'immersive sim': 'Immersive Sim',
  'boomer shooter': 'Boomer Shooter',
  'bullet hell': 'Bullet Hell',
  'survival horror': 'Survival Horror',
  deckbuilding: 'Deckbuilding',
  'deck building': 'Deckbuilding',
  'creature collection': 'Creature Collector',
  'monster taming': 'Creature Collector',
  'dating sim': 'Dating Sim',
  'life simulation': 'Life Sim',
  cozy: 'Cozy',
  rhythm: 'Rhythm',
  'story rich': 'Story Rich',
  'choices matter': 'Choices Matter',
  'multiple endings': 'Multiple Endings',
  anime: 'Anime',
  'pixel art': 'Pixel Graphics',
  'hand-drawn': 'Hand-drawn',
  'female protagonist': 'Female Protagonist',
  'time travel': 'Time Travel',
  'post-apocalyptic': 'Post-apocalyptic',
  cyberpunk: 'Cyberpunk',
  lovecraftian: 'Lovecraftian',
  mecha: 'Mechs',
};

// IGDB's code for Japan (ISO 3166-1 numeric).
const JAPAN = 392;

/**
 * The game's tags in Steam's words, for games Steam doesn't sell: its genres,
 * then JRPG for an RPG made in Japan (IGDB has no such genre, and its "jrpg"
 * keyword is on few games), then its themes and a few telling keywords.
 */
export function igdbTags(
  game: Pick<IgdbGame, 'genres' | 'themes' | 'keywords' | 'involved_companies'>,
): string[] {
  const genres = (game.genres ?? []).map((g) => g.name);
  const madeInJapan = (game.involved_companies ?? []).some(
    (c) => c.developer && c.company?.country === JAPAN,
  );
  const tags = [
    ...genres.flatMap((name) => TAG_NAMES[name] ?? [name]),
    ...(madeInJapan && genres.includes('Role-playing (RPG)') ? ['JRPG'] : []),
    ...(game.themes ?? []).flatMap((t) => TAG_NAMES[t.name] ?? [t.name]),
    ...(game.keywords ?? []).flatMap((k) => KEYWORD_TAGS[k.name.toLowerCase()] ?? []),
  ];
  return [...new Set(tags)];
}

// IGDB's game modes as Steam categories, which decide what counts as
// single-player (random pick, Pick My Game) and multiplayer-first.
const CATEGORY_NAMES: Record<string, string> = {
  'Single player': 'Single-player',
  Multiplayer: 'Multi-player',
  'Co-operative': 'Co-op',
  'Split screen': 'Shared/Split Screen',
  'Massively Multiplayer Online (MMO)': 'MMO',
  'Battle Royale': 'PvP',
};

export interface ManualGameDetails {
  name: string;
  platforms: string[];
  genres: string[];
  tags: string[];
  categories: string[];
  description: string | null;
  /** Display text like Steam's ("Jun 5, 2025"), so release-date sorting reads it the same way. */
  release_date: string | null;
  header_image: string | null;
  /** Not a games column: used to find the game in your Steam library. */
  steamAppIds: number[];
}

/** The game's details in the shape of the games table, or null if IGDB doesn't know it. */
export async function getGameDetails(igdbId: number): Promise<ManualGameDetails | null> {
  const [game] = await query<IgdbGame>(
    'games',
    `fields name, first_release_date, platforms.name, cover.image_id, artworks.image_id, artworks.width, artworks.height, artworks.artwork_type, screenshots.image_id, screenshots.width, genres.name, themes.name, game_modes.name, keywords.name, involved_companies.developer, involved_companies.company.country, summary, ${EXTERNAL_FIELDS}; where id = ${Math.trunc(igdbId)};`,
  );
  if (!game) return null;

  const genres = (game.genres ?? []).map((g) => g.name);
  const wideArt = pickWideArt(game);
  return {
    name: game.name,
    platforms: (game.platforms ?? []).map((p) => p.name),
    genres,
    tags: igdbTags(game),
    categories: (game.game_modes ?? []).flatMap((m) =>
      CATEGORY_NAMES[m.name] ? [CATEGORY_NAMES[m.name]] : [],
    ),
    description: game.summary ?? null,
    release_date: game.first_release_date
      ? new Date(game.first_release_date * 1000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
    header_image: wideArt ? artworkUrl(wideArt) : game.cover ? coverUrl(game.cover.image_id) : null,
    steamAppIds: steamAppIds(game),
  };
}
