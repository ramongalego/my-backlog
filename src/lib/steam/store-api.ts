import { fetchWithTimeout, TIMEOUTS } from '@/lib/fetch-with-timeout';

export interface SteamGameDetails {
  success: boolean;
  data?: {
    type: string;
    name: string;
    steam_appid: number;
    short_description: string;
    header_image: string;
    genres?: Array<{ id: string; description: string }>;
    categories?: Array<{ id: number; description: string }>;
    release_date?: { coming_soon: boolean; date: string };
  };
}

export interface SteamReviewsResponse {
  success: number;
  query_summary: {
    review_score: number;
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
}

export async function getGameDetails(appId: number): Promise<SteamGameDetails | null> {
  try {
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`,
      { next: { revalidate: 86400 } } as RequestInit, // Cache for 24 hours
      TIMEOUTS.STEAM_STORE,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[appId.toString()] || null;
  } catch {
    return null;
  }
}

export function extractGameMetadata(details: SteamGameDetails) {
  if (!details.success || !details.data) {
    return null;
  }

  const { data } = details;

  return {
    type: data.type || null,
    genres: data.genres?.map((g) => g.description) || [],
    categories: data.categories?.map((c) => c.description) || [],
    description: data.short_description || null,
    release_date: data.release_date?.date || null,
    header_image: data.header_image || null,
  };
}

// ─── Steam Tag Resolution ─────────────────────────────────────────────────────
// Uses Steam's official IStoreService/GetTagList + IStoreBrowseService/GetItems
// instead of SteamSpy, which is rate-limited and unreliable.

let cachedTagMap: Map<number, string> | null = null;
let tagMapTimestamp = 0;
const TAG_MAP_CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours — tag names rarely change

async function getTagNameMap(): Promise<Map<number, string> | null> {
  if (cachedTagMap && Date.now() - tagMapTimestamp < TAG_MAP_CACHE_DURATION) {
    return cachedTagMap;
  }

  try {
    const response = await fetchWithTimeout(
      'https://api.steampowered.com/IStoreService/GetTagList/v1/?language=english',
      {},
      TIMEOUTS.STEAM_STORE,
    );

    if (!response.ok) {
      console.error(`[Steam Tags] Failed to fetch tag list: HTTP ${response.status}`);
      return cachedTagMap; // Return stale cache if available
    }

    const data = await response.json();
    const tags: { tagid: number; name: string }[] = data?.response?.tags ?? [];

    if (tags.length === 0) {
      console.error('[Steam Tags] Tag list returned empty');
      return cachedTagMap;
    }

    cachedTagMap = new Map(tags.map((t) => [t.tagid, t.name]));
    tagMapTimestamp = Date.now();
    console.log(`[Steam Tags] Tag map refreshed: ${cachedTagMap.size} tags`);
    return cachedTagMap;
  } catch (error) {
    console.error('[Steam Tags] Exception fetching tag list:', error);
    return cachedTagMap;
  }
}

export async function getSteamTags(appId: number): Promise<string[] | null> {
  try {
    const tagMap = await getTagNameMap();
    if (!tagMap) return null;

    const params = JSON.stringify({
      ids: [{ appid: appId }],
      context: { language: 'english', country_code: 'US' },
      data_request: { include_tag_count: 20 },
    });

    const response = await fetchWithTimeout(
      `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(params)}`,
      { next: { revalidate: 86400 } } as RequestInit,
      TIMEOUTS.STEAM_STORE,
    );

    if (!response.ok) {
      console.error(`[Steam Tags] GetItems failed for appId=${appId}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const items: { tagids?: number[] }[] = data?.response?.store_items ?? [];

    if (!items.length || !items[0].tagids?.length) {
      console.warn(`[Steam Tags] No tags returned for appId=${appId}`);
      return null;
    }

    // Tag IDs are already sorted by weight (most voted first)
    const tagNames = items[0].tagids
      .map((id) => tagMap.get(id))
      .filter((name): name is string => !!name);

    return tagNames.length > 0 ? tagNames : null;
  } catch (error) {
    console.error(`[Steam Tags] Exception for appId=${appId}:`, error);
    return null;
  }
}

export interface SteamReviewData {
  score: number;
  count: number;
}

export async function getSteamReviewData(appId: number): Promise<SteamReviewData | null> {
  try {
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all`,
      { next: { revalidate: 86400 } } as RequestInit,
      TIMEOUTS.STEAM_STORE,
    );

    if (!response.ok) {
      return null;
    }

    const data: SteamReviewsResponse = await response.json();

    if (!data.success || !data.query_summary || data.query_summary.total_reviews === 0) {
      return null;
    }

    const { total_positive, total_reviews } = data.query_summary;
    return {
      score: Math.round((total_positive / total_reviews) * 100),
      count: total_reviews,
    };
  } catch {
    return null;
  }
}

// resolved_category: 0=Unknown, 1=Unsupported, 2=Playable, 3=Verified
export async function getSteamDeckCompat(appId: number): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appId}`,
      { next: { revalidate: 86400 } } as RequestInit,
      TIMEOUTS.STEAM_STORE,
    );
    if (!response.ok) return null;
    const data = await response.json();
    const category = data?.results?.resolved_category;
    console.log(`[deck-compat] appId=${appId} resolved_category=${category}`);
    if (typeof category !== 'number' || category === 0) return null;
    return category;
  } catch {
    return null;
  }
}
