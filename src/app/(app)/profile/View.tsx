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
import { focusActivityRow, RecentActivity } from '@/components/profile/RecentActivity';
import { PlaysOn } from '@/components/profile/PlaysOn';
import { AccountPanel } from '@/components/profile/AccountPanel';
import { useProfilePage } from '@/hooks/useProfilePage';
import { useConnectSteam } from '@/hooks/useConnectSteam';
import { PROFILE_COLUMNS } from '@/components/profile/profile-layout';
import { ProfilePageSkeleton } from './Skeleton';

export default function ProfileView() {
  const { connect: connectSteam } = useConnectSteam();
  const profile = useProfilePage();
  const [choosingFavorites, setChoosingFavorites] = useState(false);
  const [changing, setChanging] = useState<
    'email' | 'password' | 'delete-account' | 'disconnect-steam' | null
  >(null);
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
              hasPassword={profile.account.signIn.hasPassword}
              onDelete={profile.account.deleteAccount}
              onDownloadData={profile.account.downloadData}
              onClose={() => setChanging(null)}
            />
          )}
          {changing === 'disconnect-steam' && (
            <DisconnectSteamDialog
              steamGames={profile.account.steamGames}
              onDisconnect={profile.account.disconnectSteam}
              onDownloadData={profile.account.downloadData}
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
            signIn={profile.account.signIn}
            onSetPassword={profile.account.sendPasswordReset}
            steam={profile.steam}
            onConnectSteam={connectSteam}
            onChangeEmail={() => setChanging('email')}
            onChangePassword={() => setChanging('password')}
            onDisconnectSteam={() => setChanging('disconnect-steam')}
            onDownloadData={profile.account.downloadData}
            onDeleteAccount={() => setChanging('delete-account')}
          />
        </aside>
      </div>
    </Page>
  );
}
