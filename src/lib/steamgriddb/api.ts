// SteamGridDB: community-made game art, for games added by hand that IGDB has
// no official key art for (older games, many Nintendo ones). Server only: it
// uses the app's API key.
import 'server-only';
import { getSteamGridDbKey } from '@/lib/server/env';
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
  /** A small copy of it, for lists. */
  thumb?: string;
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
 * The game a name means, of SteamGridDB's search results: the one with that
 * exact name. When several share it (a remake and its original, like Ocarina
 * of Time in 1998 and 2026), the one released closest to `year`, within a
 * year. A lone match is taken whatever its year, since IGDB often dates a game
 * by a later re-release.
 */
function pickGame(results: SearchResult[], name: string, year: number | null) {
  const named = results.filter((r) => normalize(r.name) === normalize(name));
  const yearsOff = (r: SearchResult) =>
    year === null || !r.release_date
      ? 0
      : Math.abs(new Date(r.release_date * 1000).getUTCFullYear() - year);
  const game = named.length === 1 ? named[0] : named.sort((a, b) => yearsOff(a) - yearsOff(b))[0];
  return !game || (named.length > 1 && yearsOff(game) > 1) ? null : game;
}

const search = (name: string, key: string) =>
  get<SearchResult[]>(`/search/autocomplete/${encodeURIComponent(name)}`, key);

/** A game's grids that are art, in SteamGridDB's own order, full size first. */
function artOf(grids: Grid[] | null): Grid[] {
  const art = (grids ?? []).filter((g) => ART_STYLES.has(g.style));
  return [...art.filter((g) => g.width >= 920), ...art.filter((g) => g.width < 920)];
}

/**
 * The game's best wide art on SteamGridDB, or null. Found by its exact name
 * (see pickGame). Of its grids, the first in SteamGridDB's own order that's
 * art, preferring full size. Never throws: art is a nicety, and IGDB's is
 * still there.
 */
export async function findWideArt(name: string, year: number | null): Promise<string | null> {
  const key = getSteamGridDbKey();
  if (!key) return null;
  try {
    const game = pickGame((await search(name, key)) ?? [], name, year);
    if (!game) return null;
    return artOf(await get<Grid[]>(`/grids/game/${game.id}?${GRID_QUERY}`, key))[0]?.url ?? null;
  } catch (err) {
    console.error('SteamGridDB lookup failed:', err);
    return null;
  }
}

/** An image a player can choose for a game: the art, and a small copy to pick it by. */
export interface ArtChoice {
  url: string;
  thumb: string;
}

/** As many as the picker shows: with the original, six rows of three. */
const MAX_CHOICES = 17;

/**
 * Every wide image SteamGridDB has for a game, for the player to choose from
 * (Choose art), best first. A game Steam sells is found by its Steam id, which
 * can't be the wrong game; any other by its exact name, as findWideArt does.
 * Empty when SteamGridDB has none; null when it couldn't be asked (no key, or
 * it didn't answer), so the picker can say so rather than "no art".
 */
export async function listWideArt({
  name,
  year,
  steamAppId,
}: {
  name: string;
  year: number | null;
  steamAppId: number | null;
}): Promise<ArtChoice[] | null> {
  const key = getSteamGridDbKey();
  if (!key) return null;
  try {
    let grids = steamAppId
      ? await get<Grid[]>(`/grids/steam/${steamAppId}?${GRID_QUERY}`, key)
      : null;
    if (!grids?.length) {
      const results = await search(name, key);
      if (!results) return null;
      const game = pickGame(results, name, year);
      grids = game ? await get<Grid[]>(`/grids/game/${game.id}?${GRID_QUERY}`, key) : [];
    }
    const seen = new Set<string>();
    return artOf(grids)
      .filter((g) => !seen.has(g.url) && seen.add(g.url))
      .slice(0, MAX_CHOICES)
      .map((g) => ({ url: g.url, thumb: g.thumb ?? g.url }));
  } catch (err) {
    console.error('SteamGridDB lookup failed:', err);
    return null;
  }
}
