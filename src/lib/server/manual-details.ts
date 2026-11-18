import 'server-only';
// For the Add game dialog's preview and the add route.
import { getGameDetails, type ManualGameDetails } from '@/lib/igdb/api';
import { getStoreItemInfo } from '@/lib/steam/store-api';
import { findWideArt } from '@/lib/steamgriddb/api';
import { parseReleaseDate } from '@/lib/games/release-date';
import { calculateBayesianScore } from '@/lib/games/scoring';

interface AddableGameDetails extends ManualGameDetails {
  /** When Steam sells it too, for its reviews. */
  steam_app_id: number | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
}

/**
 * Steam's art and tags win when Steam sells the game: its header fits the
 * shape every game image uses, and its tags match the rest of the library.
 * Art, best first: Steam's, IGDB's key art, SteamGridDB's, then IGDB's rest.
 */
export async function getAddableGameDetails(igdbId: number): Promise<AddableGameDetails | null> {
  const details = await getGameDetails(igdbId);
  if (!details) return null;
  const appId = details.steamAppIds[0] ?? null;
  const steam = appId ? await getStoreItemInfo(appId) : null;
  const reviews = steam?.reviews ?? null;
  const steamArt = steam?.headerImage2x ?? steam?.headerImage ?? null;
  const releasedIn = parseReleaseDate(details.release_date);
  const communityArt =
    steamArt || details.hasKeyArt
      ? null
      : await findWideArt(details.name, releasedIn ? new Date(releasedIn).getUTCFullYear() : null);
  return {
    ...details,
    header_image: steamArt ?? communityArt ?? details.header_image,
    tags: steam?.tags ?? details.tags,
    steam_app_id: appId,
    steam_review_score: reviews?.score ?? null,
    steam_review_count: reviews?.count ?? null,
    steam_review_weighted: reviews ? calculateBayesianScore(reviews.score, reviews.count) : null,
  };
}
