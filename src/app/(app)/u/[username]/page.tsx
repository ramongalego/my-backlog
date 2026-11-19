import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Page } from '@/components/layout/Page';
import { PrefetchedQueries } from '@/components/layout/PrefetchedQueries';
import { PlaysOn } from '@/components/profile/PlaysOn';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PublicFavorites } from '@/components/profile/PublicFavorites';
import { RatingSpread } from '@/components/profile/RatingSpread';
import { RecentActivity } from '@/components/profile/RecentActivity';
import { PROFILE_COLUMNS } from '@/components/profile/profile-layout';
import { publicProfilePath } from '@/lib/account/public-profile';
import { cleanUsername } from '@/lib/account/username';
import { prefetchForUser } from '@/lib/data/prefetch';
import { queries } from '@/lib/data/queries';
import { ownUsername } from '@/lib/server/own-username';
import { getPublicProfile } from '@/lib/server/public-profile';
import ProfileView from './View';

interface PageProps {
  params: Promise<{ username: string }>;
}

// cache() dedupes the lookups between generateMetadata and the page render.
const viewer = cache(ownUsername);
const load = cache(getPublicProfile);

/** The signed-in player's own username when this is their address, however it was typed. */
async function ownAddress(typed: string): Promise<string | null> {
  const own = await viewer();
  return own && own === cleanUsername(typed) ? own : null;
}

// Reached by its link, not through a search engine.
const robots = { index: false, follow: false };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  if (await ownAddress(username)) {
    return {
      title: 'Profile',
      description: 'Your favorite games and what you have been playing.',
      robots,
    };
  }
  const profile = await load(username);
  if (!profile) return {};
  return {
    title:
      profile.name === profile.username
        ? `@${profile.username}`
        : `${profile.name} (@${profile.username})`,
    description: `What ${profile.name} plays, on MyBacklog.`,
    robots,
  };
}

/**
 * The player's own profile, with everything on it and everything to change:
 * read as their other pages are, from their own rows, so it is theirs to see
 * whether or not it is private.
 */
async function OwnProfile() {
  // The profile's figures, favorites and activity all come from the Games list.
  const state = await prefetchForUser((supabase, userId) => [
    // Grows with the library: stream it rather than hold the page for it.
    { ...queries.gamesList(userId, supabase), stream: true },
    queries.playing(userId, supabase),
    queries.favoriteGames(userId, supabase),
    // What Recent activity is drawn from, besides the games themselves.
    queries.history(userId, supabase),
    // Which starts came from a pick.
    queries.playedPicks(userId, supabase),
    // For the game dialog (a queued game shows as Queue), as Games and Stats do.
    queries.queue(userId, supabase),
  ]);

  return (
    <>
      <PrefetchedQueries state={state} />
      <ProfileView />
    </>
  );
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;

  const own = await ownAddress(username);
  if (own) {
    // One address for a profile: capitals in a typed one go to the real one.
    if (username !== own) redirect(publicProfilePath(own));
    return <OwnProfile />;
  }

  const profile = await load(username);
  if (!profile) notFound();
  if (username !== profile.username) redirect(publicProfilePath(profile.username));

  return (
    <Page>
      <ProfileHeader
        name={profile.name}
        username={profile.username}
        avatar={profile.avatar}
        figures={profile.figures}
      />
      <div className={PROFILE_COLUMNS}>
        <div className="min-w-0 space-y-10">
          <PublicFavorites games={profile.favorites} />
          {/* The player's own list, given only the highlights and nothing to open. */}
          {profile.activity.length > 0 && (
            <RecentActivity entries={profile.activity} library={profile.library} />
          )}
        </div>
        <aside className="min-w-0 space-y-6">
          {/* Not links: the Games page they'd lead to is the visitor's own library. */}
          <PlaysOn platforms={profile.platforms} linked={false} />
          <RatingSpread counts={profile.ratings} />
        </aside>
      </div>
    </Page>
  );
}
