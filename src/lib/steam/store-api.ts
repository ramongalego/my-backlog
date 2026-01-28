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
    metacritic?: { score: number };
  };
}

export async function getGameDetails(appId: number): Promise<SteamGameDetails | null> {
  try {
    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
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
    metacritic: data.metacritic?.score || null,
    header_image: data.header_image || null,
  };
}
