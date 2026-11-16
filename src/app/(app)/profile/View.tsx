'use client';

import { useRef, useState } from 'react';
import { Page, PageHeader } from '@/components/layout/Page';
import { LoadError } from '@/components/ui/LoadError';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { FavoriteGames, type FavoriteGamesHandle } from '@/components/profile/FavoriteGames';
import { FavoritesPicker } from '@/components/profile/FavoritesPicker';
import { ChangeEmailDialog } from '@/components/profile/ChangeEmailDialog';
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog';
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
  const [changing, setChanging] = useState<'email' | 'password' | null>(null);
  const favoritesRow = useRef<FavoriteGamesHandle>(null);

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
          <FavoriteGames
            ref={favoritesRow}
            games={profile.favorites}
            onChoose={() => {
              profile.favoriteActions.forgetUndo();
              setChoosingFavorites(true);
            }}
            onReorder={profile.favoriteActions.reorder}
            onRemove={profile.favoriteActions.remove}
          />
          <RecentActivity entries={profile.activity} />
        </div>
        <aside className="space-y-6" aria-label="Platforms and account">
          <PlaysOn platforms={profile.platforms} />
          <AccountPanel
            email={profile.email}
            pendingEmail={profile.account.pendingEmail}
            steam={profile.steam}
            onConnectSteam={connectSteam}
            onChangeEmail={() => setChanging('email')}
            onChangePassword={() => setChanging('password')}
          />
        </aside>
      </div>
    </Page>
  );
}
