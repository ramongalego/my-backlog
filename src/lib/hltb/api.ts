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
// Also splits letter-digit boundaries so e.g. "Birth1" becomes "Birth 1".
function toSearchTerms(name: string): string[] {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
}

class HLTBAuthError extends Error {}

async function searchHLTB(config: HLTBConfig, gameName: string): Promise<number | null> {
  const payload: Record<string, unknown> = {
    searchType: 'games',
    searchTerms: toSearchTerms(gameName),
    searchPage: 1,
    size: 2,
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
  if (!res.ok) {
    console.error(`[HLTB] Search failed for "${gameName}": HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const results: { comp_main: number }[] = data?.data ?? [];
  if (!results.length) return null;

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
async function searchWithRetry(gameName: string): Promise<number | null> {
  const config = await getHLTBConfig();
  if (!config) return null;
  try {
    return await searchHLTB(config, gameName);
  } catch (err) {
    if (!(err instanceof HLTBAuthError)) throw err;
    invalidateConfig(config);
    const fresh = await getHLTBConfig();
    if (!fresh) return null;
    try {
      return await searchHLTB(fresh, gameName);
    } catch (retryErr) {
      if (!(retryErr instanceof HLTBAuthError)) throw retryErr;
      console.error(`[HLTB] 403 Forbidden for "${gameName}" even with a fresh token`);
      invalidateConfig(fresh);
      return null;
    }
  }
}

export async function getMainStoryHours(gameName: string): Promise<number | null> {
  try {
    const result = await searchWithRetry(gameName);
    if (result !== null) return result;

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
    console.error(`[HLTB] Exception for "${gameName}":`, error);
    return null;
  }
}
