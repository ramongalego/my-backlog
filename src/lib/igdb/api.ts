// IGDB (Twitch's game database), for games added by hand. Server only: it
// uses the app's Twitch credentials.
import { getIgdbCredentials } from '@/lib/env.server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API_URL = 'https://api.igdb.com/v4';
const IMAGE_URL = 'https://images.igdb.com/igdb/image/upload';
const TIMEOUT_MS = 8000;

// Main games and their re-releases: no DLC, bundles, mods, episodes or updates.
// 0 main game, 4 standalone expansion, 8 remake, 9 remaster, 10 expanded game, 11 port.
const GAME_TYPES = '(0,4,8,9,10,11)';

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

interface IgdbGame {
  id: number;
  name: string;
  first_release_date?: number;
  platforms?: { name: string }[];
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
  genres?: { name: string }[];
  themes?: { name: string }[];
  game_modes?: { name: string }[];
  summary?: string;
}

export interface GameSearchResult {
  igdbId: number;
  name: string;
  year: number | null;
  cover: string | null;
  platforms: string[];
}

export function coverUrl(imageId: string) {
  return `${IMAGE_URL}/t_cover_big/${imageId}.jpg`;
}

export function artworkUrl(imageId: string) {
  return `${IMAGE_URL}/t_1080p/${imageId}.jpg`;
}

export async function searchGames(text: string): Promise<GameSearchResult[]> {
  const games = await query<IgdbGame>(
    'games',
    `search ${quoted(text)}; fields name, first_release_date, platforms.name, cover.image_id; where game_type = ${GAME_TYPES} & version_parent = null; limit 12;`,
  );
  return games.map((g) => ({
    igdbId: g.id,
    name: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    cover: g.cover ? coverUrl(g.cover.image_id) : null,
    platforms: (g.platforms ?? []).map((p) => p.name),
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
}

/** The game's details in the shape of the games table, or null if IGDB doesn't know it. */
export async function getGameDetails(igdbId: number): Promise<ManualGameDetails | null> {
  const [game] = await query<IgdbGame>(
    'games',
    `fields name, first_release_date, platforms.name, cover.image_id, artworks.image_id, genres.name, themes.name, game_modes.name, summary; where id = ${Math.trunc(igdbId)};`,
  );
  if (!game) return null;

  const genres = (game.genres ?? []).map((g) => g.name);
  const tags = [...genres, ...(game.themes ?? []).map((t) => t.name)].flatMap(
    (name) => TAG_NAMES[name] ?? [name],
  );
  // Wide artwork fits the app's cards; the tall box art is the fallback
  // (CoverArt sets it on a blurred copy of itself).
  const artwork = game.artworks?.[0];
  return {
    name: game.name,
    platforms: (game.platforms ?? []).map((p) => p.name),
    genres,
    tags: [...new Set(tags)],
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
    header_image: artwork
      ? artworkUrl(artwork.image_id)
      : game.cover
        ? coverUrl(game.cover.image_id)
        : null,
  };
}
