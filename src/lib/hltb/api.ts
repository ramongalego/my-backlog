import 'server-only';
import { secondsToHours } from './time-utils';
import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://howlongtobeat.com';
const BASE_HEADERS = { 'User-Agent': USER_AGENT, Referer: BASE_URL };

const FALLBACK_SEARCH_ENDPOINT = '/api/search/site';

interface HLTBConfig {
  searchEndpoint: string;
  authToken: string;
  // An anti-bot pair older HLTB builds required, sent when init returns one.
  hpKey?: string;
  hpVal?: string;
}

// Cached together: both come from the same JS bundle.
let cachedConfig: HLTBConfig | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60;

// Concurrent lookups (sync runs several) share one config fetch instead of
// each scraping the bundle.
let pendingConfig: Promise<HLTBConfig | null> | null = null;

// Options are walked by balanced braces so the match doesn't depend on
// property order in the minified chunk.
function findPostEndpoints(scriptContent: string): string[] {
  const endpoints: string[] = [];
  const fetchStart = /fetch\s*\(\s*["'](\/api\/[a-zA-Z0-9_/]+)["']\s*,\s*\{/g;
  for (const match of scriptContent.matchAll(fetchStart)) {
    const url = match[1];
    const braceIdx = match.index! + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = braceIdx; i < scriptContent.length; i++) {
      const ch = scriptContent[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const opts = scriptContent.substring(braceIdx, end + 1);
    if (/method\s*:\s*["']POST["']/i.test(opts)) endpoints.push(url);
  }
  return endpoints;
}

async function discoverSearchEndpoint(): Promise<string> {
  const homeRes = await fetchWithTimeout(BASE_URL, { headers: BASE_HEADERS }, TIMEOUTS.HLTB);
  if (!homeRes.ok) {
    console.error(`[HLTB] Home page returned HTTP ${homeRes.status}`);
    return FALLBACK_SEARCH_ENDPOINT;
  }
  const html = await homeRes.text();
  const scriptPaths = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(
    (m) => m[1],
  );

  for (const path of scriptPaths) {
    const scriptRes = await fetchWithTimeout(
      BASE_URL + path,
      { headers: BASE_HEADERS },
      TIMEOUTS.HLTB,
    );
    if (!scriptRes.ok) continue;
    // The bundle has other POST endpoints (e.g. /api/error), so only accept
    // one that looks like search.
    const search = findPostEndpoints(await scriptRes.text()).find((url) => url.includes('search'));
    if (search) return search;
  }

  console.error('[HLTB] Could not find search endpoint in any JS chunk, using fallback');
  return FALLBACK_SEARCH_ENDPOINT;
}

async function fetchHLTBConfig(): Promise<HLTBConfig | null> {
  try {
    const searchEndpoint = await discoverSearchEndpoint();

    // The token endpoint is the search endpoint + /init, e.g.
    // POST /api/search/site → GET /api/search/site/init?t=timestamp
    const initRes = await fetchWithTimeout(
      `${BASE_URL}${searchEndpoint}/init?t=${Date.now()}`,
      { headers: BASE_HEADERS },
      TIMEOUTS.HLTB,
    );
    if (!initRes.ok) {
      console.error(`[HLTB] Init endpoint returned HTTP ${initRes.status}`);
      return null;
    }
    const initData = await initRes.json();
    if (!initData?.token) {
      console.error('[HLTB] Init response missing token');
      return null;
    }

    return {
      searchEndpoint,
      authToken: initData.token,
      hpKey: initData.hpKey,
      hpVal: initData.hpVal,
    };
  } catch (err) {
    console.error('[HLTB] Config fetch threw:', err);
    return null;
  }
}

async function getHLTBConfig(): Promise<HLTBConfig | null> {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedConfig;
  }

  pendingConfig ??= fetchHLTBConfig().then((config) => {
    if (config) {
      cachedConfig = config;
      cacheTimestamp = Date.now();
    }
    pendingConfig = null;
    return config;
  });
  return pendingConfig;
}

function invalidateConfig(stale: HLTBConfig): void {
  // Only clear if nobody has refreshed it in the meantime.
  if (cachedConfig === stale) cachedConfig = null;
}

// Punctuation confuses HLTB's search. Accents come off first ("Pokemon", not
// "Pok mon"), and letter-digit boundaries split ("Birth1" as "Birth 1").
function toSearchTerms(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
}

class HLTBAuthError extends Error {}

/**
 * HLTB allows a burst of about 60-80 searches, then answers 429 for up to a
 * minute. Unlike a null result this says nothing about the game, so it must
 * not count as a miss.
 */
export class HLTBUnavailableError extends Error {
  constructor() {
    super('HowLongToBeat is rate limiting requests');
    this.name = 'HLTBUnavailableError';
  }
}

// After a 429, searches are skipped for a while rather than sent only to be
// refused, which also keeps the block from being extended.
const BLOCK_COOLDOWN_MS = 30_000;
let blockedUntil = 0;

/** In ms; 0 when searches aren't paused. */
export function hltbBlockedForMs(): number {
  return Math.max(0, blockedUntil - Date.now());
}

function assertNotBlocked() {
  if (Date.now() < blockedUntil) throw new HLTBUnavailableError();
}

interface SearchOptions {
  /**
   * Over the most popular result, so the original wins over a remake that
   * shares its words ("Pokémon Omega Ruby and Alpha Sapphire").
   */
  preferShortestTitle?: boolean;
}

const titleWords = (title: string) => toSearchTerms(title).map((w) => w.toLowerCase());

interface HLTBResult {
  game_name?: string;
  /** "game", "dlc", "hack"... */
  game_type?: string;
  /** Main story, in seconds; 0 when nobody has submitted a time yet. */
  comp_main: number;
  /** The year it first came out; 0 when HLTB doesn't know. */
  release_world?: number;
}

/** One search's answer, before choosing between games that share a title. */
interface Found {
  /** HLTB's most popular match. */
  hours: number | null;
  /**
   * Games titled exactly as searched: HLTB lists an original and its remake
   * under one title ("Dead Space", 2008 and 2023). Null hours: no time yet.
   */
  editions: { year: number; hours: number | null }[];
}

/**
 * Else the newest older edition, since a port comes out after its original.
 * A remake too new to have a time gets none, not the original's.
 */
function hoursIn(found: Found, year: number | null | undefined): number | null {
  if (!year || found.editions.length < 2) return found.hours;
  const edition =
    found.editions.find((e) => e.year === year) ??
    found.editions.filter((e) => e.year < year).sort((a, b) => b.year - a.year)[0];
  return edition ? edition.hours : found.hours;
}

async function searchHLTB(
  config: HLTBConfig,
  gameName: string,
  { preferShortestTitle = false }: SearchOptions = {},
): Promise<Found | null> {
  assertNotBlocked();
  const terms = toSearchTerms(gameName);
  const payload: Record<string, unknown> = {
    searchType: 'games',
    searchTerms: terms,
    searchPage: 1,
    // Enough to see every game that shares the title, not only the top one.
    size: 8,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: '', flow: '', genre: { mode: 'include', values: [] } },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };

  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    'Content-Type': 'application/json',
    'x-auth-token': config.authToken,
  };
  if (config.hpKey && config.hpVal) {
    payload[config.hpKey] = config.hpVal;
    headers['x-hp-key'] = config.hpKey;
    headers['x-hp-val'] = config.hpVal;
  }

  const res = await fetchWithTimeout(
    BASE_URL + config.searchEndpoint,
    { method: 'POST', headers, body: JSON.stringify(payload) },
    TIMEOUTS.HLTB,
  );

  if (res.status === 403) throw new HLTBAuthError();
  if (res.status === 429) {
    blockedUntil = Date.now() + BLOCK_COOLDOWN_MS;
    throw new HLTBUnavailableError();
  }
  if (!res.ok) {
    console.error(`[HLTB] Search failed for "${gameName}": HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const results: HLTBResult[] = data?.data ?? [];
  if (!results.length) return null;

  const wanted = terms.map((t) => t.toLowerCase());
  const editions = results
    .filter((r) => r.game_name && r.release_world && (r.game_type ?? 'game') === 'game')
    .filter((r) => titleWords(r.game_name!).join(' ') === wanted.join(' '))
    .map((r) => ({
      year: r.release_world!,
      hours: r.comp_main > 0 ? secondsToHours(r.comp_main) : null,
    }));

  if (preferShortestTitle) {
    const original = results
      .filter((r) => r.comp_main > 0 && r.game_name)
      .filter((r) => {
        const words = titleWords(r.game_name!);
        return wanted.every((w) => words.includes(w));
      })
      .sort((a, b) => a.game_name!.length - b.game_name!.length)[0];
    if (original) return { hours: secondsToHours(original.comp_main), editions };
  }

  const ONE_HOUR_SECONDS = 3600;
  const first = results[0];
  const second = results[1];

  const best =
    first.comp_main > 0 &&
    first.comp_main < ONE_HOUR_SECONDS &&
    second?.comp_main >= ONE_HOUR_SECONDS
      ? second
      : first;

  return { hours: best.comp_main ? secondsToHours(best.comp_main) : null, editions };
}

// HLTB answers 403 to an expired token: refresh it once.
async function searchWithRetry(gameName: string, options?: SearchOptions): Promise<Found | null> {
  const config = await getHLTBConfig();
  if (!config) return null;
  try {
    return await searchHLTB(config, gameName, options);
  } catch (err) {
    if (!(err instanceof HLTBAuthError)) throw err;
    invalidateConfig(config);
    const fresh = await getHLTBConfig();
    if (!fresh) return null;
    try {
      return await searchHLTB(fresh, gameName, options);
    } catch (retryErr) {
      if (!(retryErr instanceof HLTBAuthError)) throw retryErr;
      console.error(`[HLTB] 403 Forbidden for "${gameName}" even with a fresh token`);
      invalidateConfig(fresh);
      return null;
    }
  }
}

/** The searches for a name, in the order tried, stopping at the first with a time. */
async function searchAll(gameName: string): Promise<Found[]> {
  const found: Found[] = [];
  /** True once it has a time. */
  const search = async (name: string, options?: SearchOptions) => {
    const result = await searchWithRetry(name, options);
    if (!result) return false;
    found.push(result);
    return result.hours !== null || result.editions.some((e) => e.hours !== null);
  };

  if (await search(gameName)) return found;

  // HLTB lists "Pokémon Ruby Version" as "Pokémon Ruby and Sapphire" and its
  // search needs every word in the title.
  if (/\bversion\b/i.test(gameName)) {
    const withoutVersion = gameName
      .replace(/\bversion\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (await search(withoutVersion, { preferShortestTitle: true })) return found;
  }

  const hasEditionWord = /\b(edition|enhanced|complete|ultimate|definitive)\b/i.test(gameName);
  const hasYearInParens = /\(\d{4}\)/.test(gameName);

  if (hasEditionWord || hasYearInParens) {
    const stripped = gameName
      .replace(/\b(edition|enhanced|complete|ultimate|definitive)\b/gi, '')
      .replace(/\(\d{4}\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    await search(stripped);
  }

  return found;
}

/**
 * Asked once the release year is known: the search doesn't need it, so it can
 * start before the game's details arrive (see fetchGameMetadata).
 */
export type MainStoryTimes = (releaseYear?: number | null) => number | null;

/** Throws HLTBUnavailableError while HLTB is rate limiting. */
export async function findMainStoryTimes(gameName: string): Promise<MainStoryTimes> {
  let found: Found[];
  try {
    found = await searchAll(gameName);
  } catch (error) {
    if (error instanceof HLTBUnavailableError) throw error;
    console.error(`[HLTB] Exception for "${gameName}":`, error);
    found = [];
  }

  // Steam names the older game by its year once a remake takes the title
  // ("Dead Space (2008)"): that says which one it is better than the date it
  // came to the store.
  const named = /\((\d{4})\)/.exec(gameName);
  const namedYear = named ? Number(named[1]) : null;

  return (releaseYear) => {
    for (const search of found) {
      const hours = hoursIn(search, namedYear ?? releaseYear);
      if (hours !== null) return hours;
    }
    return null;
  };
}

/**
 * Null when HLTB has no time or the lookup failed. Throws HLTBUnavailableError
 * while HLTB is rate limiting, so callers retry later instead of recording a miss.
 */
export async function getMainStoryHours(
  gameName: string,
  releaseYear?: number | null,
): Promise<number | null> {
  return (await findMainStoryTimes(gameName))(releaseYear);
}
