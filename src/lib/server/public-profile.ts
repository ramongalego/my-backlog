import 'server-only';
import { cache } from 'react';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { reuse } from '@/lib/server/reuse';
import {
  loadCurrentlyPlaying,
  loadFavoriteGames,
  loadGamesList,
  loadPlayedPicks,
  loadRecentHistory,
  loadHistorySince,
} from '@/lib/data/loaders';
import { activityByDay, activityFrom, HIGHLIGHTS, recentActivity } from '@/lib/account/activity';
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
 * How long what a profile's library comes to, and whether a name can be
 * shown, are reused. Each read of a library takes all of it, and anyone can
 * ask for any profile: this keeps a page being hammered to one read a minute,
 * and nothing a visitor is shown is older than that.
 */
const REUSE_MS = 60 * 1000;

const NO_KEY = 'Public profiles need the Supabase secret key';

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
 * Whether the database says a name can be shown to others (name_allowed). The
 * answer depends on the name alone, so it is reused by the name.
 */
const nameAllowed = reuse(
  async (name: string): Promise<boolean> => {
    const service = tryCreateServiceClient();
    if (!service) throw new Error(NO_KEY);
    const { data, error } = await service.rpc('name_allowed', { p_name: name });
    if (error) throw error;
    return data === true;
  },
  { ms: REUSE_MS, max: 2000 },
);

/**
 * The name the player chose, else their Steam name, when it can be shown to
 * others; else the username. A Steam name isn't picked here, so it's checked
 * like any other. Never the email.
 */
async function shownName(profile: ProfileRow): Promise<string> {
  for (const name of [profile.display_name, profile.steam_username]) {
    const candidate = name?.trim();
    if (!candidate) continue;
    try {
      if (await nameAllowed(candidate)) return candidate;
    } catch (error) {
      // Unchecked is not shown: the username is always safe.
      console.error('Checking a public name failed:', error);
      break;
    }
  }
  return profile.username;
}
type FromLibrary = Pick<
  PublicProfile,
  'figures' | 'ratings' | 'favorites' | 'platforms' | 'library' | 'activity' | 'activityDays'
>;

/** What the player's library comes to: the part worth reusing for a minute. */
async function readLibrary(userId: string): Promise<FromLibrary> {
  const service = tryCreateServiceClient();
  if (!service) throw new Error(NO_KEY);

  const [games, picked, playing, history, picks, weeks] = await Promise.all([
    loadGamesList(service, userId),
    loadFavoriteGames(service, userId),
    loadCurrentlyPlaying(service, userId),
    loadRecentHistory(service, userId, HISTORY_READ),
    loadPlayedPicks(service, userId),
    loadHistorySince(service, userId, activityFrom()),
  ]);
  const platforms = countPlatforms(games, 'all');
  // Only the highlights; folded into rows as the player's own list is. Worked
  // out here, on a server: which day it was for the player isn't known.
  const activity = recentActivity(games, playing, history, {
    only: HIGHLIGHTS,
    picks,
    zoneKnown: false,
  });

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
    // Days in this server's time zone, as the page that draws them goes by.
    activityDays: activityByDay(games, weeks),
  };
}

const reusedLibrary = reuse(readLibrary, { ms: REUSE_MS, max: 500 });

/**
 * The profile with that username as it may be shown, or null: nobody has it,
 * its player made it private, or it could not be a username at all (which
 * never reaches the database). Read afresh on every request, and once in
 * each: a profile made private, renamed or given a new picture shows at once.
 */
const shownRow = cache(async (typed: string): Promise<ProfileRow | null> => {
  const username = cleanUsername(typed);
  // Past this it holds nothing but letters, numbers, - and _.
  if (usernameProblem(username)) return null;

  const service = tryCreateServiceClient();
  if (!service) throw new Error(NO_KEY);

  const { data: profile, error } = await service
    .from('profiles')
    .select('id, username, display_name, steam_username, avatar_url, steam_avatar, is_private')
    .eq('username', username)
    .maybeSingle<ProfileRow>();
  if (error) throw error;
  return profile && !profile.is_private ? profile : null;
});

/**
 * Whether there is a profile to show at that address. One read, so a page can
 * answer "not found" before it starts on anything else; a private profile
 * answers exactly as one nobody has.
 */
export async function publicProfileExists(typed: string): Promise<boolean> {
  return (await shownRow(typed)) !== null;
}

/**
 * A profile as anyone may see it, or null when there's none to show.
 *
 * Read with the server's key, since nobody can read another player's rows.
 * The profile's own row is read afresh; what its library comes to is reused
 * for a minute. Only what the page shows leaves this function.
 */
export async function getPublicProfile(typed: string): Promise<PublicProfile | null> {
  const profile = await shownRow(typed);
  if (!profile) return null;

  const [name, fromLibrary] = await Promise.all([shownName(profile), reusedLibrary(profile.id)]);

  return {
    username: profile.username,
    name,
    avatar: profileAvatar(profile.avatar_url, profile.steam_avatar),
    ...fromLibrary,
  };
}
