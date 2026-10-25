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

const STORE_ASSET_BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/';
const GET_ITEMS_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/';
const STORE_CONTEXT = { language: 'english', country_code: 'US' };

export interface SteamReviewData {
  /** Percent of reviews that are positive, 0–100. */
  score: number;
  count: number;
}

interface StoreItemReviews {
  // The figure Steam shows on the store page: all languages, with off-topic
  // review bombs filtered out.
  summary_filtered?: { review_count?: number; percent_positive?: number };
}

function reviewData(reviews: StoreItemReviews | undefined): SteamReviewData | null {
  const summary = reviews?.summary_filtered;
  if (!summary?.review_count || summary.percent_positive == null) return null;
  return { score: summary.percent_positive, count: summary.review_count };
}

interface StoreItemAssets {
  asset_url_format?: string;
  header?: string;
  header_2x?: string;
}

export interface StoreItemInfo {
  /** Tag names, most voted first. */
  tags: string[] | null;
  /**
   * The 920×430 version of the store header, when the game has one. Steam's
   * appdetails only returns the 460×215 header, which looks soft anywhere
   * it's shown larger than that.
   */
  headerImage2x: string | null;
  reviews: SteamReviewData | null;
}

function headerImage2x(assets: StoreItemAssets | undefined): string | null {
  if (!assets?.asset_url_format || !assets.header_2x || assets.header_2x === assets.header) {
    return null;
  }
  return STORE_ASSET_BASE + assets.asset_url_format.replace('${FILENAME}', assets.header_2x);
}

/** Tags, high-resolution header art and review summary for one app, from a single GetItems call. */
export async function getStoreItemInfo(appId: number): Promise<StoreItemInfo | null> {
  try {
    const tagMap = await getTagNameMap();

    const params = JSON.stringify({
      ids: [{ appid: appId }],
      context: STORE_CONTEXT,
      data_request: { include_tag_count: 20, include_assets: true, include_reviews: true },
    });

    const response = await fetchWithTimeout(
      `${GET_ITEMS_URL}?input_json=${encodeURIComponent(params)}`,
      { next: { revalidate: 86400 } } as RequestInit,
      TIMEOUTS.STEAM_STORE,
    );

    if (!response.ok) {
      console.error(`[Steam Store] GetItems failed for appId=${appId}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const item:
      { tagids?: number[]; assets?: StoreItemAssets; reviews?: StoreItemReviews } | undefined =
      data?.response?.store_items?.[0];
    if (!item) return null;

    // Tag IDs are already sorted by weight (most voted first)
    const tagNames =
      tagMap && item.tagids?.length
        ? item.tagids.map((id) => tagMap.get(id)).filter((name): name is string => !!name)
        : [];
    if (!tagNames.length) console.warn(`[Steam Tags] No tags returned for appId=${appId}`);

    return {
      tags: tagNames.length > 0 ? tagNames : null,
      headerImage2x: headerImage2x(item.assets),
      reviews: reviewData(item.reviews),
    };
  } catch (error) {
    console.error(`[Steam Store] Exception for appId=${appId}:`, error);
    return null;
  }
}

export async function getSteamTags(appId: number): Promise<string[] | null> {
  return (await getStoreItemInfo(appId))?.tags ?? null;
}

const REVIEWS_BATCH_SIZE = 50;

/**
 * Current review summaries for many apps, 50 per GetItems call. Apps Steam
 * returns no reviews for are left out. A failed batch is skipped rather than
 * failing the rest.
 */
export async function getStoreReviews(appIds: number[]): Promise<Map<number, SteamReviewData>> {
  const result = new Map<number, SteamReviewData>();
  for (let i = 0; i < appIds.length; i += REVIEWS_BATCH_SIZE) {
    const batch = appIds.slice(i, i + REVIEWS_BATCH_SIZE);
    const params = JSON.stringify({
      ids: batch.map((appid) => ({ appid })),
      context: STORE_CONTEXT,
      data_request: { include_reviews: true },
    });
    try {
      const response = await fetchWithTimeout(
        `${GET_ITEMS_URL}?input_json=${encodeURIComponent(params)}`,
        { cache: 'no-store' },
        TIMEOUTS.STEAM_STORE,
      );
      if (!response.ok) {
        console.error(`[Steam Store] GetItems reviews batch failed: HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      const items: { appid?: number; reviews?: StoreItemReviews }[] =
        data?.response?.store_items ?? [];
      for (const item of items) {
        const reviews = reviewData(item.reviews);
        if (item.appid && reviews) result.set(item.appid, reviews);
      }
    } catch (error) {
      console.error('[Steam Store] GetItems reviews batch failed:', error);
    }
  }
  return result;
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
