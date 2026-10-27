import { secondsToHours } from './time-utils';
import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://howlongtobeat.com';
const BASE_HEADERS = { 'User-Agent': USER_AGENT, Referer: BASE_URL };

// Used if the endpoint can't be discovered from the bundle (it was
// /api/search/site as of Oct 2026).
const FALLBACK_SEARCH_ENDPOINT = '/api/search/site';

interface HLTBConfig {
  searchEndpoint: string;
  authToken: string;
  // Older HLTB builds also required an anti-bot key/value pair. Kept optional
  // so we keep working if they bring it back.
  hpKey?: string;
  hpVal?: string;
}

// Cache both the endpoint and token together — they come from the same JS bundle
let cachedConfig: HLTBConfig | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Concurrent callers share one in-flight config fetch instead of each scraping
// the HLTB bundle (sync runs several lookups in parallel).
let pendingConfig: Promise<HLTBConfig | null> | null = null;

// Scans a minified JS chunk for `fetch("/api/...", { ...method:"POST"... })`
// calls. Each fetch call's options are walked by balanced braces so the match
// doesn't depend on property order. Returns every POST endpoint found.
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

// Strip special characters that confuse HLTB search, then split into terms.
// Accents come off their letters first ("Pokémon" is searched as "Pokemon",
// not "Pok mon"), and letter-digit boundaries split, so e.g. "Birth1" becomes
// "Birth 1".
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
 * HowLongToBeat is refusing requests. It allows a burst of roughly 60–80
 * searches, then answers 429 for everything for up to a minute. Unlike a null
 * result this says nothing about whether it has a time for the game, so it
 * must not count as a miss.
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

/** How much longer searches are paused after a 429, in ms (0 when they are not). */
export function hltbBlockedForMs(): number {
  return Math.max(0, blockedUntil - Date.now());
}

function assertNotBlocked() {
  if (Date.now() < blockedUntil) throw new HLTBUnavailableError();
}

interface SearchOptions {
  /**
   * Take the shortest title that has every search word, instead of the most
   * popular result: the original game rather than a remake or sequel that
   * shares its words ("Pokémon Ruby and Sapphire", not "Pokémon Omega Ruby
   * and Alpha Sapphire").
   */
  preferShortestTitle?: boolean;
}

/** A title as search words, lowercased, for comparing with the terms. */
const titleWords = (title: string) => toSearchTerms(title).map((w) => w.toLowerCase());

async function searchHLTB(
  config: HLTBConfig,
  gameName: string,
  { preferShortestTitle = false }: SearchOptions = {},
): Promise<number | null> {
  assertNotBlocked();
  const terms = toSearchTerms(gameName);
  const payload: Record<string, unknown> = {
    searchType: 'games',
    searchTerms: terms,
    searchPage: 1,
    size: preferShortestTitle ? 8 : 2,
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
  const results: { game_name?: string; comp_main: number }[] = data?.data ?? [];
  if (!results.length) return null;

  if (preferShortestTitle) {
    const wanted = terms.map((t) => t.toLowerCase());
    const original = results
      .filter((r) => r.comp_main > 0 && r.game_name)
      .filter((r) => {
        const words = titleWords(r.game_name!);
        return wanted.every((w) => words.includes(w));
      })
      .sort((a, b) => a.game_name!.length - b.game_name!.length)[0];
    if (original) return secondsToHours(original.comp_main);
  }

  const ONE_HOUR_SECONDS = 3600;
  const first = results[0];
  const second = results[1];

  // If the top result is under 1h but a second result exists with >= 1h, prefer the second
  const best =
    first.comp_main > 0 &&
    first.comp_main < ONE_HOUR_SECONDS &&
    second?.comp_main >= ONE_HOUR_SECONDS
      ? second
      : first;

  return best.comp_main ? secondsToHours(best.comp_main) : null;
}

// Runs a search, refreshing the token once if HLTB rejects it as expired.
async function searchWithRetry(gameName: string, options?: SearchOptions): Promise<number | null> {
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

/**
 * HLTB's main-story time in hours, or null when it has none or the lookup
 * failed. Throws HLTBUnavailableError while HLTB is rate limiting, so callers
 * can retry later instead of recording a miss.
 */
export async function getMainStoryHours(gameName: string): Promise<number | null> {
  try {
    const result = await searchWithRetry(gameName);
    if (result !== null) return result;

    // "Pokémon Ruby Version": HLTB lists the pair as one game ("Pokémon Ruby
    // and Sapphire"), and its search needs every word in the title. Without
    // "Version", and taking the original over a remake with the same words.
    if (/\bversion\b/i.test(gameName)) {
      const withoutVersion = gameName
        .replace(/\bversion\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      const paired = await searchWithRetry(withoutVersion, { preferShortestTitle: true });
      if (paired !== null) return paired;
    }

    // Fallback: strip common edition/variant words and parenthesised years, then retry
    const hasEditionWord = /\b(edition|enhanced|complete|ultimate|definitive)\b/i.test(gameName);
    const hasYearInParens = /\(\d{4}\)/.test(gameName);

    if (hasEditionWord || hasYearInParens) {
      const stripped = gameName
        .replace(/\b(edition|enhanced|complete|ultimate|definitive)\b/gi, '')
        .replace(/\(\d{4}\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return searchWithRetry(stripped);
    }

    return null;
  } catch (error) {
    if (error instanceof HLTBUnavailableError) throw error;
    console.error(`[HLTB] Exception for "${gameName}":`, error);
    return null;
  }
}
