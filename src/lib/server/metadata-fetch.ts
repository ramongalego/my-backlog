import 'server-only';
import {
  getGameDetails,
  extractGameMetadata,
  getStoreItemInfo,
  getSteamDeckCompat,
} from '@/lib/steam/store-api';
import { findMainStoryTimes, HLTBUnavailableError, type MainStoryTimes } from '@/lib/hltb/api';
import { releaseYear } from '@/lib/games/release-date';
import { calculateBayesianScore } from '@/lib/games/scoring';
import { classifyAppType } from '@/lib/games/software';
import type { GameMetadata } from '@/lib/games/metadata-cache';

/** `hltbUnavailable`: HLTB was too busy to ask. Not stored. */
export type FetchedMetadata = GameMetadata & { hltbUnavailable: boolean };

/**
 * Keeps "rate limited" apart from "has no time". The time is read once the
 * release year is known, which tells a remake from its original.
 */
async function lookUpHours(name: string): Promise<{ times: MainStoryTimes; unavailable: boolean }> {
  try {
    return { times: await findMainStoryTimes(name), unavailable: false };
  } catch (err) {
    if (err instanceof HLTBUnavailableError) return { times: () => null, unavailable: true };
    throw err;
  }
}

// Null when Steam has no store details (unknown or removed app); throws
// SteamUnavailableError when Steam is too busy to say.
export async function fetchGameMetadata(
  appId: number,
  nameHint?: string,
): Promise<FetchedMetadata | null> {
  const detailsRequest = getGameDetails(appId);
  // The hint lets HLTB start alongside the details, but is only kept when it
  // is Steam's own name: this goes into the cache every user reads, and the
  // hint comes from the request.
  const hintedHours = nameHint ? lookUpHours(nameHint) : null;
  const noHours = { times: () => null, unavailable: false };
  const hoursRequest = detailsRequest.then(
    (details) => {
      const steamName = details?.data?.name;
      if (!steamName) return noHours;
      return hintedHours && nameHint === steamName ? hintedHours : lookUpHours(steamName);
    },
    // A failed details request is reported by the await below.
    () => noHours,
  );

  // Started alongside the details (they never throw); dropped for anything
  // that turns out not to be a game.
  const enrichment = Promise.all([
    hoursRequest,
    getStoreItemInfo(appId),
    getSteamDeckCompat(appId),
  ]);

  const details = await detailsRequest;
  const extracted = details ? extractGameMetadata(details) : null;

  if (!extracted) return null;

  const isGame = extracted.type === 'game';
  const [hltb, storeItem, deckCompat] = isGame ? await enrichment : [noHours, null, null];
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
    // 920×430 first, so the art stays sharp in large spots.
    header_image: storeItem?.headerImage2x ?? extracted.header_image,
    steam_review_score: steamReviewData?.score ?? null,
    steam_review_count: steamReviewData?.count ?? null,
    steam_review_weighted: weightedScore,
    main_story_hours: hltb.times(releaseYear(extracted.release_date)),
    deck_compat: deckCompat,
    tags,
    synced_at: new Date().toISOString(),
    hltbUnavailable: hltb.unavailable,
  };
}
