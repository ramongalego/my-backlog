import 'server-only';
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

/**
 * Unlike a null from getGameDetails, says nothing about whether the app exists:
 * retry the game later rather than marking it synced.
 */
export class SteamUnavailableError extends Error {
  constructor(appId: number, reason: string) {
    super(`Steam appdetails unavailable for ${appId}: ${reason}`);
    this.name = 'SteamUnavailableError';
  }
}

/**
 * Null when Steam has none (delisted or unknown). Throws SteamUnavailableError
 * when Steam is down or rate limiting (it allows about 200 calls per 5 minutes).
 */
export async function getGameDetails(appId: number): Promise<SteamGameDetails | null> {
  let data: Record<string, SteamGameDetails> | null;
  try {
    // Not cached by Next: a throttled answer must never be replayed as the real one.
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`,
      { cache: 'no-store' },
      TIMEOUTS.STEAM_STORE,
    );
    if (!response.ok) throw new SteamUnavailableError(appId, `HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    if (error instanceof SteamUnavailableError) throw error;
    throw new SteamUnavailableError(appId, String(error));
  }

  // When throttled, Steam can also answer 200 with a bare `null`.
  if (!data) throw new SteamUnavailableError(appId, 'empty response');
  return data[appId.toString()] ?? null;
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

// Steam's own tag APIs, not SteamSpy, which is rate-limited and unreliable.

let cachedTagMap: Map<number, string> | null = null;
let tagMapTimestamp = 0;
const TAG_MAP_CACHE_DURATION = 1000 * 60 * 60 * 24; // Tag names rarely change.

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
      return cachedTagMap;
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

interface StoreItemInfo {
  /** Tag names, most voted first. */
  tags: string[] | null;
  /** 920×430. appdetails only has the 460×215 one, which looks soft shown larger. */
  headerImage2x: string | null;
  /** 460×215, for when there's no larger one. */
  headerImage: string | null;
  reviews: SteamReviewData | null;
}

function headerImage(assets: StoreItemAssets | undefined): string | null {
  if (!assets?.asset_url_format || !assets.header) return null;
  return STORE_ASSET_BASE + assets.asset_url_format.replace('${FILENAME}', assets.header);
}

function headerImage2x(assets: StoreItemAssets | undefined): string | null {
  if (!assets?.asset_url_format || !assets.header_2x || assets.header_2x === assets.header) {
    return null;
  }
  return STORE_ASSET_BASE + assets.asset_url_format.replace('${FILENAME}', assets.header_2x);
}

// Current store art sits in a folder named for its content hash.
const HASHED_ASSET = /^[0-9a-f]{40}\//;

/**
 * Some older games list a `header_2x.jpg` at the old fixed path that was never
 * uploaded (Trine 2), so one there is checked. Hashed art always exists.
 */
async function verifiedHeaderImage2x(
  assets: StoreItemAssets | undefined,
  known?: string | null,
): Promise<string | null> {
  const url = headerImage2x(assets);
  if (!url || HASHED_ASSET.test(assets!.header_2x!)) return url;
  // The art already stored for this game: it was checked when it was saved.
  if (url === known) return url;
  try {
    const response = await fetchWithTimeout(url, { method: 'HEAD' }, TIMEOUTS.STEAM_STORE);
    return response.ok ? url : null;
  } catch {
    return null;
  }
}

async function bestHeaderImage(
  assets: StoreItemAssets | undefined,
  known?: string | null,
): Promise<string | null> {
  return (await verifiedHeaderImage2x(assets, known)) ?? headerImage(assets);
}

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

    // Steam sorts tag ids by votes, most first.
    const tagNames =
      tagMap && item.tagids?.length
        ? item.tagids.map((id) => tagMap.get(id)).filter((name): name is string => !!name)
        : [];
    if (!tagNames.length) console.warn(`[Steam Tags] No tags returned for appId=${appId}`);

    return {
      tags: tagNames.length > 0 ? tagNames : null,
      headerImage2x: await verifiedHeaderImage2x(item.assets),
      headerImage: headerImage(item.assets),
      reviews: reviewData(item.reviews),
    };
  } catch (error) {
    console.error(`[Steam Store] Exception for appId=${appId}:`, error);
    return null;
  }
}

const ITEMS_BATCH_SIZE = 50;
const ITEMS_CONCURRENCY = 4;

interface StoreItem {
  appid?: number;
  assets?: StoreItemAssets;
  reviews?: StoreItemReviews;
}

/** A failed batch is skipped rather than failing the rest. */
async function getItemsInBatches<T>(
  appIds: number[],
  dataRequest: Record<string, unknown>,
  pick: (item: StoreItem) => T | null | Promise<T | null>,
): Promise<Map<number, T>> {
  const result = new Map<number, T>();
  const batches: number[][] = [];
  for (let i = 0; i < appIds.length; i += ITEMS_BATCH_SIZE) {
    batches.push(appIds.slice(i, i + ITEMS_BATCH_SIZE));
  }

  const run = async (batch: number[]) => {
    const params = JSON.stringify({
      ids: batch.map((appid) => ({ appid })),
      context: STORE_CONTEXT,
      data_request: dataRequest,
    });
    try {
      const response = await fetchWithTimeout(
        `${GET_ITEMS_URL}?input_json=${encodeURIComponent(params)}`,
        { cache: 'no-store' },
        TIMEOUTS.STEAM_STORE,
      );
      if (!response.ok) {
        console.error(`[Steam Store] GetItems batch failed: HTTP ${response.status}`);
        return;
      }
      const data = await response.json();
      const items: StoreItem[] = data?.response?.store_items ?? [];
      await Promise.all(
        items.map(async (item) => {
          const value = item.appid ? await pick(item) : null;
          if (item.appid && value != null) result.set(item.appid, value);
        }),
      );
    } catch (error) {
      console.error('[Steam Store] GetItems batch failed:', error);
    }
  };

  for (let i = 0; i < batches.length; i += ITEMS_CONCURRENCY) {
    await Promise.all(batches.slice(i, i + ITEMS_CONCURRENCY).map(run));
  }
  return result;
}

export interface StoreSummary {
  reviews: SteamReviewData | null;
  headerImage: string | null;
}

/**
 * Delisted apps are left out. An old-path 2x header matching `knownArt` isn't
 * checked again, so a refresh that changes nothing makes no extra requests.
 */
export function getStoreSummaries(
  appIds: number[],
  knownArt: ReadonlyMap<number, string | null> = new Map(),
): Promise<Map<number, StoreSummary>> {
  return getItemsInBatches(
    appIds,
    { include_reviews: true, include_assets: true },
    async (item) => ({
      reviews: reviewData(item.reviews),
      headerImage: await bestHeaderImage(item.assets, knownArt.get(item.appid!)),
    }),
  );
}

/** Apps no longer on the store are left out. */
export function getStoreHeaderImages(appIds: number[]): Promise<Map<number, string>> {
  return getItemsInBatches(appIds, { include_assets: true }, (item) =>
    bestHeaderImage(item.assets),
  );
}

const LEGACY_CHECK_CONCURRENCY = 10;

/**
 * The old fixed path still has art for many delisted games GetItems doesn't
 * know. Each URL is checked so a missing image is never stored.
 */
export async function findLegacyHeaderImages(appIds: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  for (let i = 0; i < appIds.length; i += LEGACY_CHECK_CONCURRENCY) {
    await Promise.all(
      appIds.slice(i, i + LEGACY_CHECK_CONCURRENCY).map(async (appId) => {
        const url = `${STORE_ASSET_BASE}steam/apps/${appId}/header.jpg`;
        try {
          const response = await fetchWithTimeout(url, { method: 'HEAD' }, TIMEOUTS.STEAM_STORE);
          if (response.ok) result.set(appId, url);
        } catch {
          // Leave it without art.
        }
      }),
    );
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
