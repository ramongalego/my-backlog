import { secondsToHours } from "./time-utils";
import { fetchWithTimeout, TIMEOUTS } from "@/lib/fetch-with-timeout";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BASE_URL = "https://howlongtobeat.com";

// Cache the search endpoint to avoid fetching it every time
let cachedSearchEndpoint: string | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

async function getSearchEndpoint(): Promise<string | null> {
  // Return cached endpoint if still valid
  if (cachedSearchEndpoint && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedSearchEndpoint;
  }

  try {
    // Fetch homepage to find script URLs
    const homeRes = await fetchWithTimeout(
      BASE_URL,
      { headers: { "User-Agent": USER_AGENT, Referer: BASE_URL } },
      TIMEOUTS.HLTB
    );
    const html = await homeRes.text();

    // Find all _next scripts
    const scriptMatches = [
      ...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g),
    ];

    // Search through scripts to find the one with the search endpoint
    for (const match of scriptMatches) {
      const scriptUrl = BASE_URL + match[1];
      const scriptRes = await fetchWithTimeout(
        scriptUrl,
        { headers: { "User-Agent": USER_AGENT, Referer: BASE_URL } },
        TIMEOUTS.HLTB
      );
      const scriptContent = await scriptRes.text();

      // Look for fetch POST to /api/
      const searchMatch = scriptContent.match(
        /fetch\s*\(\s*["']([^"']*\/api\/[a-zA-Z0-9_\/]+)["']\s*,\s*\{[^}]*method:\s*["']POST["']/i
      );

      if (searchMatch) {
        cachedSearchEndpoint = searchMatch[1];
        cacheTimestamp = Date.now();
        return cachedSearchEndpoint;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/api/search/init?t=${Date.now()}`,
      { headers: { "User-Agent": USER_AGENT, Referer: BASE_URL } },
      TIMEOUTS.HLTB
    );
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

export async function getMainStoryHours(
  gameName: string
): Promise<number | null> {
  try {
    const [searchEndpoint, authToken] = await Promise.all([
      getSearchEndpoint(),
      getAuthToken(),
    ]);

    if (!searchEndpoint || !authToken) {
      return null;
    }

    const payload = {
      searchType: "games",
      searchTerms: gameName.split(" "),
      searchPage: 1,
      size: 1,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: "popular",
          rangeCategory: "main",
          rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
          rangeYear: { max: "", min: "" },
          modifier: "",
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    };

    const res = await fetchWithTimeout(
      BASE_URL + searchEndpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          Referer: BASE_URL,
          "x-auth-token": authToken,
        },
        body: JSON.stringify(payload),
      },
      TIMEOUTS.HLTB
    );

    if (!res.ok) return null;

    const data = await res.json();
    const game = data?.data?.[0];

    if (!game?.comp_main) return null;

    // comp_main is in seconds, convert to hours (1 decimal place)
    return secondsToHours(game.comp_main);
  } catch (error) {
    console.error(`HLTB search failed for "${gameName}":`, error);
    return null;
  }
}
