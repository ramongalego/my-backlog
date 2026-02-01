import { fetchWithTimeout, TIMEOUTS } from "@/lib/fetch-with-timeout";

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
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      { next: { revalidate: 86400 } } as RequestInit, // Cache for 24 hours
      TIMEOUTS.STEAM_STORE
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

export interface SteamReviewData {
  score: number;
  count: number;
}

export async function getSteamReviewData(appId: number): Promise<SteamReviewData | null> {
  try {
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all`,
      { next: { revalidate: 86400 } } as RequestInit,
      TIMEOUTS.STEAM_STORE
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
