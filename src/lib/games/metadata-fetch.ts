import {
  getGameDetails,
  extractGameMetadata,
  getSteamReviewData,
  getSteamTags,
  getSteamDeckCompat,
} from '@/lib/steam/store-api';
import { getMainStoryHours } from '@/lib/hltb/api';
import { calculateBayesianScore } from './scoring';

export interface GameMetadata {
  app_id: number;
  platform: string;
  type: string | null;
  name: string | null;
  genres: string[] | null;
  categories: string[] | null;
  description: string | null;
  release_date: string | null;
  header_image: string | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
  main_story_hours: number | null;
  deck_compat: number | null;
  tags: string[] | null;
  synced_at: string;
}

// Fetches a full metadata snapshot for a single app_id from Steam + HLTB.
// Returns null if Steam store details aren't available (unknown/removed app).
// Used by both the per-user sync flow and the scheduled refresh cron.
export async function fetchGameMetadata(
  appId: number,
  nameHint?: string,
): Promise<GameMetadata | null> {
  const details = await getGameDetails(appId);
  const extracted = details ? extractGameMetadata(details) : null;

  if (!extracted) return null;

  const isGame = extracted.type === 'game';

  // Only fetch enriched data for actual games — skip DLC, software, etc.
  const [mainStoryHours, steamReviewData, tags, deckCompat] = isGame
    ? await Promise.all([
        getMainStoryHours(nameHint || details?.data?.name || ''),
        getSteamReviewData(appId),
        getSteamTags(appId),
        getSteamDeckCompat(appId),
      ])
    : [null, null, null, null];

  const weightedScore = steamReviewData
    ? calculateBayesianScore(steamReviewData.score, steamReviewData.count)
    : null;

  return {
    app_id: appId,
    platform: 'PC',
    type: extracted.type,
    name: details?.data?.name ?? null,
    genres: extracted.genres,
    categories: extracted.categories,
    description: extracted.description,
    release_date: extracted.release_date,
    header_image: extracted.header_image,
    steam_review_score: steamReviewData?.score ?? null,
    steam_review_count: steamReviewData?.count ?? null,
    steam_review_weighted: weightedScore,
    main_story_hours: mainStoryHours,
    deck_compat: deckCompat,
    tags: tags,
    synced_at: new Date().toISOString(),
  };
}
