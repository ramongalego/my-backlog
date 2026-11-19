'use client';

import { useRef, useState } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { LoadError } from '@/components/ui/LoadError';
import { EditProfileLink } from '@/components/profile/EditProfileLink';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { FavoriteGames, type FavoriteGamesHandle } from '@/components/profile/FavoriteGames';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { FavoritesPicker } from '@/components/profile/FavoritesPicker';
import { FavoritesUnavailable } from '@/components/profile/FavoritesUnavailable';
import { focusActivityRow, RecentActivity } from '@/components/profile/RecentActivity';
import { PlaysOn } from '@/components/profile/PlaysOn';
import { RatingSpread } from '@/components/profile/RatingSpread';
import { useProfilePage } from '@/hooks/useProfilePage';
import { PROFILE_COLUMNS } from '@/components/profile/profile-layout';
import { ProfilePageSkeleton } from './Skeleton';

export default function ProfileView() {
  const profile = useProfilePage();
  const [choosingFavorites, setChoosingFavorites] = useState(false);
  const favoritesRow = useRef<FavoriteGamesHandle>(null);
  // Which section a game's dialog was opened from. If the change it saves
  // takes the row it was opened from away, focus goes to the row that game is
  // in now (its rows in Recent activity fold into a group), or else to the
  // section (a favorite hidden, a game removed), not to the page.
  const openedFrom = useRef<{ section: 'favorites' | 'activity'; game: number } | null>(null);
  const openFavorite = (gameId: number) => {
    openedFrom.current = { section: 'favorites', game: gameId };
    profile.openGame(gameId);
  };
  const openActivity = (gameId: number) => {
    openedFrom.current = { section: 'activity', game: gameId };
    profile.openGame(gameId);
  };
  const focusOpenedFrom = () => {
    const from = openedFrom.current;
    if (from?.section === 'activity') {
      if (!focusActivityRow(from.game)) document.getElementById('profile-activity')?.focus();
    } else {
      favoritesRow.current?.focus();
    }
  };

  if (profile.loading) return <ProfilePageSkeleton />;

  // Figures and lists would all describe an empty library.
  if (profile.loadError) {
    return (
      <Page>
        <PageHeader title="Profile" />
        <LoadError what="your profile" onRetry={profile.retry} />
      </Page>
    );
  }

  return (
    <Page
      overlay={
        <>
          {choosingFavorites && (
            <FavoritesPicker
              {...profile.favoritePicker}
              onClose={() => setChoosingFavorites(false)}
              onOpenerGone={() => favoritesRow.current?.focus()}
            />
          )}
          {profile.gameDialog && (
            <GameDetailModal isOpen {...profile.gameDialog} onOpenerGone={focusOpenedFrom} />
          )}
        </>
      }
    >
      <ProfileHeader
        name={profile.name}
        username={profile.username}
        avatar={profile.avatar}
        figures={profile.figures}
        action={<EditProfileLink />}
      />
      <div className={PROFILE_COLUMNS}>
        <div className="min-w-0 space-y-10">
          {profile.favoritesState === 'ready' ? (
            <FavoriteGames
              ref={favoritesRow}
              games={profile.favorites}
              onOpen={openFavorite}
              onChoose={() => {
                profile.favoriteActions.forgetUndo();
                setChoosingFavorites(true);
              }}
              onReorder={profile.favoriteActions.reorder}
              onRemove={profile.favoriteActions.remove}
            />
          ) : (
            <FavoritesUnavailable
              failed={profile.favoritesState === 'failed'}
              onRetry={profile.retryFavorites}
            />
          )}
          <RecentActivity entries={profile.activity} onOpen={openActivity} />
        </div>
        {/* min-w-0: its one-line values are cut to fit, not allowed to widen the page. */}
        <aside className="min-w-0 space-y-6">
          <PlaysOn platforms={profile.platforms} />
          <RatingSpread counts={profile.ratings} />
        </aside>
      </div>
    </Page>
  );
}
