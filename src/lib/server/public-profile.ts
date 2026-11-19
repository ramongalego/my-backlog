import 'server-only';
import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import {
  loadCurrentlyPlaying,
  loadFavoriteGames,
  loadGamesList,
  loadRecentHistory,
} from '@/lib/data/loaders';
import { HIGHLIGHTS, recentActivity } from '@/lib/account/activity';
import { pickedFavorites } from '@/lib/account/favorites';
import { profileFigures, ratingSpread } from '@/lib/account/figures';
import { profileAvatar } from '@/lib/account/identity';
import { cleanUsername, usernameProblem } from '@/lib/account/username';
import { libraryPlatforms } from '@/lib/games/consoles';
import { countPlatforms } from '@/lib/games/library-filter';
import { publicActivity, type PublicProfile } from '@/lib/account/public-profile';

/**
 * How many of the latest events the activity is drawn from. Most are
 * housekeeping it leaves out, so it reads more than the Profile page does.
 */
const HISTORY_READ = 200;

/**
 * How long what a profile's library comes to is reused. Each read takes the
 * whole library, and anyone can ask for any profile: this keeps a page being
 * hammered to one read a minute.
 */
const REUSE_SECONDS = 60;

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  steam_username: string | null;
  avatar_url: string | null;
  steam_avatar: string | null;
  is_private: boolean;
}

/**
 * The name the player chose, else their Steam name, when the database says it
 * can be shown to others (name_allowed); else the username. A Steam name isn't
 * picked here, so it's checked every time. Never the email.
 */
async function shownName(service: SupabaseClient, profile: ProfileRow): Promise<string> {
  for (const name of [profile.display_name, profile.steam_username]) {
    const candidate = name?.trim();
    if (!candidate) continue;
    const { data: allowed, error } = await service.rpc('name_allowed', { p_name: candidate });
    if (error) {
      // Unchecked is not shown: the username is always safe.
      console.error('Checking a public name failed:', error);
      break;
    }
    if (allowed === true) return candidate;
  }
  return profile.username;
}

type FromLibrary = Pick<
  PublicProfile,
  'figures' | 'ratings' | 'favorites' | 'platforms' | 'library' | 'activity'
>;

/** What the player's library comes to: the part worth reusing for a minute. */
async function readLibrary(userId: string): Promise<FromLibrary> {
  const service = tryCreateServiceClient();
  if (!service) throw new Error('Public profiles need the Supabase secret key');

  const [games, picked, playing, history] = await Promise.all([
    loadGamesList(service, userId),
    loadFavoriteGames(service, userId),
    loadCurrentlyPlaying(service, userId),
    loadRecentHistory(service, userId, HISTORY_READ),
  ]);
  const platforms = countPlatforms(games, 'all');
  // Only the highlights; folded into rows as the player's own list is.
  const activity = recentActivity(games, playing, history, { only: HIGHLIGHTS });

  return {
    figures: profileFigures(games),
    ratings: ratingSpread(games),
    favorites: pickedFavorites(games, picked).map(({ name, header_image, rating }) => ({
      name,
      header_image,
      rating,
    })),
    platforms: [...platforms]
      .map(([platform, count]) => ({ name: platform, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    library: libraryPlatforms(platforms),
    activity: publicActivity(activity),
  };
}

// The key's number goes up when what's read changes shape.
const reusedLibrary = unstable_cache(readLibrary, ['public-profile-library-2'], {
  revalidate: REUSE_SECONDS,
});

/**
 * A profile as anyone may see it, or null when there's none to show: nobody
 * has that username, or its player made it private. Nothing that couldn't be a
 * username reaches the database.
 *
 * Read with the server's key, since nobody can read another player's rows.
 * The profile's own row is read afresh every time, so a profile made private,
 * renamed or given a new picture shows at once; what its library comes to is
 * reused for a minute. Only what the page shows leaves this function.
 */
export async function getPublicProfile(typed: string): Promise<PublicProfile | null> {
  const username = cleanUsername(typed);
  // Past this it holds nothing but letters, numbers, - and _.
  if (usernameProblem(username)) return null;

  const service = tryCreateServiceClient();
  if (!service) throw new Error('Public profiles need the Supabase secret key');

  const { data: profile, error } = await service
    .from('profiles')
    .select('id, username, display_name, steam_username, avatar_url, steam_avatar, is_private')
    .eq('username', username)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  if (!profile || profile.is_private) return null;

  const [name, fromLibrary] = await Promise.all([
    shownName(service, profile),
    reusedLibrary(profile.id),
  ]);

  return {
    username: profile.username,
    name,
    avatar: profileAvatar(profile.avatar_url, profile.steam_avatar),
    ...fromLibrary,
  };
}
