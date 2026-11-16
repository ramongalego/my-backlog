'use client';

import { useRef, useState } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { LoadError } from '@/components/ui/LoadError';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { FavoriteGames, type FavoriteGamesHandle } from '@/components/profile/FavoriteGames';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { FavoritesPicker } from '@/components/profile/FavoritesPicker';
import { FavoritesUnavailable } from '@/components/profile/FavoritesUnavailable';
import { ChangeEmailDialog } from '@/components/profile/ChangeEmailDialog';
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import { DisconnectSteamDialog } from '@/components/profile/DisconnectSteamDialog';
import { RecentActivity } from '@/components/profile/RecentActivity';
import { PlaysOn } from '@/components/profile/PlaysOn';
import { AccountPanel } from '@/components/profile/AccountPanel';
import { useProfilePage } from '@/hooks/useProfilePage';
import { connectSteam } from '@/lib/client/steam-connect';
import { PROFILE_COLUMNS } from '@/components/profile/profile-layout';
import { ProfilePageSkeleton } from './Skeleton';

export default function ProfileView() {
  const profile = useProfilePage();
  const [choosingFavorites, setChoosingFavorites] = useState(false);
  const [changing, setChanging] = useState<
    'email' | 'password' | 'delete-account' | 'disconnect-steam' | null
  >(null);
  const favoritesRow = useRef<FavoriteGamesHandle>(null);
  // Which section a game's dialog was opened from. If the change it saves
  // takes that game out of the section (a favorite hidden, a finished game
  // put back in the backlog), focus goes to the section, not to the page.
  const openedFrom = useRef<'favorites' | 'activity'>('favorites');
  const openFavorite = (gameId: number) => {
    openedFrom.current = 'favorites';
    profile.openGame(gameId);
  };
  const openActivity = (gameId: number) => {
    openedFrom.current = 'activity';
    profile.openGame(gameId);
  };
  const focusOpenedFrom = () => {
    if (openedFrom.current === 'favorites') favoritesRow.current?.focus();
    else document.getElementById('profile-activity')?.focus();
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
          {changing === 'email' && profile.email && (
            <ChangeEmailDialog
              email={profile.email}
              onSubmit={profile.account.changeEmail}
              onClose={() => setChanging(null)}
            />
          )}
          {changing === 'password' && profile.email && (
            <ChangePasswordDialog
              email={profile.email}
              onSubmit={profile.account.changePassword}
              onSendReset={profile.account.sendPasswordReset}
              onClose={() => setChanging(null)}
            />
          )}
          {changing === 'delete-account' && (
            <DeleteAccountDialog
              onDelete={profile.account.deleteAccount}
              onClose={() => setChanging(null)}
            />
          )}
          {changing === 'disconnect-steam' && (
            <DisconnectSteamDialog
              steamGames={profile.account.steamGames}
              onDisconnect={profile.account.disconnectSteam}
              onClose={() => setChanging(null)}
            />
          )}
        </>
      }
    >
      <ProfileHeader
        name={profile.name}
        avatar={profile.avatar}
        identity={profile.identity}
        memberSince={profile.memberSince}
        figures={profile.figures}
      />
      {/* What a profile shows of you, then the account behind it. */}
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
        <aside className="min-w-0 space-y-6" aria-label="Platforms and account">
          <PlaysOn platforms={profile.platforms} />
          <AccountPanel
            email={profile.email}
            pendingEmail={profile.account.pendingEmail}
            steam={profile.steam}
            onConnectSteam={connectSteam}
            onChangeEmail={() => setChanging('email')}
            onChangePassword={() => setChanging('password')}
            onDisconnectSteam={() => setChanging('disconnect-steam')}
            onDeleteAccount={() => setChanging('delete-account')}
          />
        </aside>
      </div>
    </Page>
  );
}
