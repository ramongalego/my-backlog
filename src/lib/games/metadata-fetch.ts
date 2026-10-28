import {
  getGameDetails,
  extractGameMetadata,
  getStoreItemInfo,
  getSteamDeckCompat,
} from '@/lib/steam/store-api';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';
import { calculateBayesianScore } from './scoring';
import { classifyAppType } from './software';

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

/** A fresh snapshot, plus whether HLTB was too busy to be asked (not stored). */
export type FetchedMetadata = GameMetadata & { hltbUnavailable: boolean };

/** HLTB's answer, with "rate limited" kept apart from "has no time". */
async function lookUpHours(name: string): Promise<{ hours: number | null; unavailable: boolean }> {
  try {
    return { hours: await getMainStoryHours(name), unavailable: false };
  } catch (err) {
    if (err instanceof HLTBUnavailableError) return { hours: null, unavailable: true };
    throw err;
  }
}

// Fetches a full metadata snapshot for a single app_id from Steam + HLTB.
// Returns null if Steam store details aren't available (unknown/removed app),
// and throws SteamUnavailableError if Steam is too busy to say.
export async function fetchGameMetadata(
  appId: number,
  nameHint?: string,
): Promise<FetchedMetadata | null> {
  const detailsRequest = getGameDetails(appId);
  // HLTB searches by name. The library's name (the hint) lets that start
  // alongside the details, but the result is only kept when the hint is
  // Steam's own name for the game: everything here goes into the cache every
  // user reads, and the hint comes from the request.
  const hintedHours = nameHint ? lookUpHours(nameHint) : null;
  const noHours = { hours: null, unavailable: false };
  const hoursRequest = detailsRequest.then(
    (details) => {
      const steamName = details?.data?.name;
      if (!steamName) return noHours;
      return hintedHours && nameHint === steamName ? hintedHours : lookUpHours(steamName);
    },
    // A failed details request is reported by the await below.
    () => noHours,
  );

  // The enrichment lookups start alongside the details instead of after them
  // (they never throw). Their results are dropped for DLC, software and
  // anything else that turns out not to be a game.
  const enrichment = Promise.all([
    hoursRequest,
    getStoreItemInfo(appId),
    getSteamDeckCompat(appId),
  ]);

  const details = await detailsRequest;
  const extracted = details ? extractGameMetadata(details) : null;

  if (!extracted) return null;

  const isGame = extracted.type === 'game';
  const [hltb, storeItem, deckCompat] = isGame
    ? await enrichment
    : [{ hours: null, unavailable: false }, null, null];
  const steamReviewData = storeItem?.reviews ?? null;
  const tags = storeItem?.tags ?? null;

  const weightedScore = steamReviewData
    ? calculateBayesianScore(steamReviewData.score, steamReviewData.count)
    : null;

  return {
    app_id: appId,
    platform: 'PC',
    type: classifyAppType(extracted.type, { genres: extracted.genres, tags }),
    name: details?.data?.name ?? null,
    genres: extracted.genres,
    categories: extracted.categories,
    description: extracted.description,
    release_date: extracted.release_date,
    // Prefer the 920×430 header so the art stays sharp in large spots.
    header_image: storeItem?.headerImage2x ?? extracted.header_image,
    steam_review_score: steamReviewData?.score ?? null,
    steam_review_count: steamReviewData?.count ?? null,
    steam_review_weighted: weightedScore,
    main_story_hours: hltb.hours,
    deck_compat: deckCompat,
    tags,
    synced_at: new Date().toISOString(),
    hltbUnavailable: hltb.unavailable,
  };
}
