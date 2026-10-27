// Server only: the details of a game being added by hand, as the Add game
// dialog previews them and the add route saves them.
import { getGameDetails, type ManualGameDetails } from '@/lib/igdb/api';
import { getStoreItemInfo } from '@/lib/steam/store-api';
import { findWideArt } from '@/lib/steamgriddb/api';
import { parseReleaseDate } from './release-date';
import { calculateBayesianScore } from './scoring';

export interface AddableGameDetails extends ManualGameDetails {
  /** The game's Steam app id when Steam sells it too, for its reviews. */
  steam_app_id: number | null;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
}

/**
 * IGDB's details, with Steam's art, tags and reviews when Steam also sells the
 * game: its store header is made for the shape every game image here uses,
 * its tags are the words the rest of the library is described in (JRPG,
 * Roguelite...), and its reviews show next to the critic score. Games Steam
 * doesn't sell keep IGDB's, and so does any game when Steam doesn't answer.
 *
 * The art, best first: Steam's header; IGDB's key art (the publisher's own);
 * SteamGridDB's community art in the same shape, often with the logo; then
 * whatever else IGDB has (plain artwork, a screenshot, the box art). Older and
 * many Nintendo games have no key art on IGDB, and its fallbacks for them are
 * a generic image or the box art over a blur.
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
