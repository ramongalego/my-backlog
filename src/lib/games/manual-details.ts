// Server only: the details of a game being added by hand, as the Add game
// dialog previews them and the add route saves them.
import { getGameDetails, type ManualGameDetails } from '@/lib/igdb/api';
import { getStoreItemInfo } from '@/lib/steam/store-api';

/**
 * IGDB's details, with Steam's art and tags when Steam also sells the game:
 * its store header is made for the shape every game image here uses, and its
 * tags are the words the rest of the library is described in (JRPG,
 * Roguelite...). Games Steam doesn't sell keep IGDB's, and so does any game
 * when Steam doesn't answer.
 */
export async function getAddableGameDetails(igdbId: number): Promise<ManualGameDetails | null> {
  const details = await getGameDetails(igdbId);
  const appId = details?.steamAppIds[0];
  if (!details || !appId) return details;

  const steam = await getStoreItemInfo(appId);
  return {
    ...details,
    header_image: steam?.headerImage2x ?? steam?.headerImage ?? details.header_image,
    tags: steam?.tags ?? details.tags,
  };
}
