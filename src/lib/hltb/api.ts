import { secondsToHours } from './time-utils';
import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://howlongtobeat.com';

interface HLTBConfig {
  searchEndpoint: string;
  authToken: string;
}

// Cache both the endpoint and token together — they come from the same JS bundle
let cachedConfig: HLTBConfig | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

async function getHLTBConfig(): Promise<HLTBConfig | null> {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    const homeRes = await fetchWithTimeout(
      BASE_URL,
      { headers: { 'User-Agent': USER_AGENT, Referer: BASE_URL } },
      TIMEOUTS.HLTB,
    );
    const html = await homeRes.text();

    const scriptMatches = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)];

    let searchEndpoint: string | null = null;

    for (const match of scriptMatches) {
      const scriptUrl = BASE_URL + match[1];
      const scriptRes = await fetchWithTimeout(
        scriptUrl,
        { headers: { 'User-Agent': USER_AGENT, Referer: BASE_URL } },
        TIMEOUTS.HLTB,
      );
      const scriptContent = await scriptRes.text();

      const endpointMatch = scriptContent.match(
        /fetch\s*\(\s*["']([^"']*\/api\/[a-zA-Z0-9_/]+)["']\s*,\s*\{[^}]*method:\s*["']POST["']/i,
      );

      if (endpointMatch) {
        searchEndpoint = endpointMatch[1];
        break;
      }
    }

    if (!searchEndpoint) return null;

    // Derive the token endpoint from the search endpoint — same pattern the Python API uses
    // e.g. /api/finder → GET /api/finder/init?t=timestamp
    const initRes = await fetchWithTimeout(
      `${BASE_URL}${searchEndpoint}/init?t=${Date.now()}`,
      { headers: { 'User-Agent': USER_AGENT, Referer: BASE_URL } },
      TIMEOUTS.HLTB,
    );
    const initData = await initRes.json();
    const authToken = initData?.token;

    if (!authToken) return null;

    cachedConfig = { searchEndpoint, authToken };
    cacheTimestamp = Date.now();
    return cachedConfig;
  } catch {
    return null;
  }
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

async function searchHLTB(config: HLTBConfig, gameName: string): Promise<number | null> {
  const payload = {
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
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { max: '', min: '' },
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

  const res = await fetchWithTimeout(
    BASE_URL + config.searchEndpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Referer: BASE_URL,
        'x-auth-token': config.authToken,
      },
      body: JSON.stringify(payload),
    },
    TIMEOUTS.HLTB,
  );

  if (!res.ok) return null;

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

export async function getMainStoryHours(gameName: string): Promise<number | null> {
  try {
    const config = await getHLTBConfig();
    if (!config) return null;

    const result = await searchHLTB(config, gameName);
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
      return searchHLTB(config, stripped);
    }

    return null;
  } catch (error) {
    console.error(`[HLTB] Exception for "${gameName}":`, error);
    return null;
  }
}
