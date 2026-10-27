// SteamGridDB: community-made game art, for games added by hand that IGDB has
// no official key art for (older games, many Nintendo ones). Server only: it
// uses the app's API key.
import { getSteamGridDbKey } from '@/lib/env.server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const API_URL = 'https://www.steamgriddb.com/api/v2';
const TIMEOUT_MS = 8000;
// Grids in Steam's header shape, the one every game image here uses, at 2x
// first; no animations, and none marked NSFW, joke or flashing.
const GRID_QUERY = 'dimensions=920x430,460x215&types=static&nsfw=false&humor=false&epilepsy=false';
// Styles that are art; "blurred" and "material" (flat icon designs) aren't.
const ART_STYLES = new Set(['alternate', 'white_logo', 'no_logo']);

interface SearchResult {
  id: number;
  name: string;
  release_date?: number;
}

interface Grid {
  url: string;
  width: number;
  style: string;
  language: string;
}

async function get<T>(path: string, key: string): Promise<T | null> {
  const res = await fetchWithTimeout(
    `${API_URL}${path}`,
    { headers: { Authorization: `Bearer ${key}` } },
    TIMEOUT_MS,
  );
  if (!res.ok) return null;
  const body: { success?: boolean; data?: T } = await res.json();
  return body.success ? (body.data ?? null) : null;
}

/** For comparing names: case, accents and punctuation aside ("Fortune's" vs "Fortune’s"). */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The game's best wide art on SteamGridDB, or null. Found by its exact name;
 * when several games share it (a remake and its original, like Ocarina of
 * Time in 1998 and 2026), the one released closest to it, within a year. A
 * lone match is taken whatever its year, since IGDB often dates a game by a
 * later re-release. Of its grids, the first in SteamGridDB's own order that's
 * art, preferring full size. Never throws: art is a nicety, and IGDB's is
 * still there.
 */
export async function findWideArt(name: string, year: number | null): Promise<string | null> {
  const key = getSteamGridDbKey();
  if (!key) return null;
  try {
    const results = await get<SearchResult[]>(
      `/search/autocomplete/${encodeURIComponent(name)}`,
      key,
    );
    const named = (results ?? []).filter((r) => normalize(r.name) === normalize(name));
    const yearsOff = (r: SearchResult) =>
      year === null || !r.release_date
        ? 0
        : Math.abs(new Date(r.release_date * 1000).getUTCFullYear() - year);
    const game = named.length === 1 ? named[0] : named.sort((a, b) => yearsOff(a) - yearsOff(b))[0];
    if (!game || (named.length > 1 && yearsOff(game) > 1)) return null;
    const grids = await get<Grid[]>(`/grids/game/${game.id}?${GRID_QUERY}`, key);
    const art = (grids ?? []).filter((g) => ART_STYLES.has(g.style));
    return (art.find((g) => g.width >= 920) ?? art[0])?.url ?? null;
  } catch (err) {
    console.error('SteamGridDB lookup failed:', err);
    return null;
  }
}
