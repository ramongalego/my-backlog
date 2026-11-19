import { CoverArt } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { TruncatedText } from '@/components/ui/TruncatedText';
import type { PublicProfile } from '@/lib/account/public-profile';
import { ProfileSection } from './ProfileSection';
import { FAVORITE_ART_SIZES, FAVORITE_GRID } from './profile-layout';

/**
 * The player's favorites as anyone sees them: to look at, not to open or move.
 * With none picked there is no section, where the player's own page has empty places.
 */
export function PublicFavorites({ games }: { games: PublicProfile['favorites'] }) {
  if (games.length === 0) return null;
  return (
    <ProfileSection id="profile-favorites" title="Favorite games">
      <ul className={FAVORITE_GRID}>
        {games.map((game, place) => (
          // The order is the player's, and a game can only be picked once.
          <li key={place} className="min-w-0">
            <div className="relative">
              <CoverArt src={game.header_image} alt="" sizes={FAVORITE_ART_SIZES} />
              {game.rating != null && (
                <Rating
                  rating={game.rating}
                  onArt
                  className="pointer-events-none absolute bottom-1.5 right-1.5"
                />
              )}
            </div>
            {/* Wrapped where the art is narrow: a long name cut short there is
                mostly its series. */}
            <TruncatedText as="p" className="mt-1.5 text-sm text-ink-200 lg:truncate">
              {game.name}
            </TruncatedText>
          </li>
        ))}
      </ul>
    </ProfileSection>
  );
}
