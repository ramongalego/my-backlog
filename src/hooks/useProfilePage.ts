'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queries } from '@/lib/data/queries';
import { useAuth, useUpdateSessionProfile } from '@/hooks/useAuth';
import { displayName, memberSince, profileAvatar, profileName } from '@/lib/account/identity';
import { profileFigures } from '@/lib/account/figures';
import { recentActivity } from '@/lib/account/activity';
import { countPlatforms } from '@/lib/games/library-filter';
import { pickedFavorites, toggleFavorite } from '@/lib/account/favorites';
import { queryKeys } from '@/lib/query-keys';
import {
  changeEmail,
  changePassword,
  deleteAccount,
  disconnectSteam,
  downloadData,
  sendPasswordReset,
} from '@/lib/client/account';
import { playsOnConsole } from '@/lib/games/consoles';
import { reloadAtTop } from '@/lib/reload';
import {
  removeAvatar,
  saveProfileName,
  squareAvatar,
  uploadAvatar,
} from '@/lib/client/profile-identity';
import { useFavoriteGames } from './useFavoriteGames';
import { useLibraryGameDialog } from './useLibraryGameDialog';

/**
 * Everything the Profile page shows, from what the app already knows: the
 * account (name, avatar, email, when it was made, Steam) and the library (the
 * Games page's list, shared, so it's downloaded once).
 */
export function useProfilePage() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const {
    data: games = [],
    isPending,
    isLoadingError,
    refetch,
  } = useQuery(queries.gamesList(userId));
  const { data: playing = null } = useQuery(queries.playing(userId));

  // The favorites are the player's to pick: none until they do.
  const favoriteGames = useFavoriteGames(userId);
  const picked = pickedFavorites(games, favoriteGames.pickedIds);
  /** The picks the page shows: one hidden since, or gone from the library, drops out. */
  const shownPicks = (ids: readonly number[]) => pickedFavorites(games, ids).map((game) => game.id);
  // A game's dialog, opened from a favorite or an activity row.
  const { gameDialog, openGame } = useLibraryGameDialog(userId);

  // A saved change goes into the session the whole app reads, so the
  // header's menu shows the new name or picture at once too.
  const updateProfile = useUpdateSessionProfile();

  return {
    loading: !!userId && isPending,
    // The first load failed: show that, not an empty profile.
    loadError: isLoadingError,
    retry: () => void refetch(),
    name: profileName(profile?.display_name, profile?.steam_username, user?.email),
    avatar: profileAvatar(profile?.avatar_url, profile?.steam_avatar),
    /** Changing the name and picture, where they're shown. */
    identity: {
      /** The name the player chose, or null when it's the account's. */
      chosenName: profile?.display_name ?? null,
      /** What the name goes back to when the chosen one is cleared. */
      accountName: displayName(profile?.steam_username, user?.email),
      /** A picture they uploaded, which can be taken off. */
      hasOwnPicture: !!profile?.avatar_url,
      rename: async (name: string | null) => {
        const result = await saveProfileName(name);
        // A failure is said beside the field, where the name is being typed.
        if (result.ok) updateProfile({ display_name: result.name });
        return result;
      },
      uploadPicture: async (file: File) => {
        const square = await squareAvatar(file);
        if (!square) {
          const error = "Couldn't read that picture. Try a JPEG or PNG.";
          toast.error(error);
          return { ok: false as const, error };
        }
        const result = await uploadAvatar(square);
        if (result.ok) updateProfile({ avatar_url: result.avatarUrl });
        else toast.error(result.error);
        return result;
      },
      removePicture: async () => {
        const result = await removeAvatar();
        if (result.ok) updateProfile({ avatar_url: null });
        else toast.error(result.error);
        return result;
      },
    },
    email: user?.email ?? null,
    memberSince: memberSince(user?.created_at),
    steam: profile?.steam_id ? { username: profile.steam_username } : null,
    figures: profileFigures(games),
    favorites: picked,
    /**
     * Whether the picks are known. Until they've loaded the row can't be
     * changed, and if they couldn't be, it says so: a row drawn empty would
     * invite picking over the saved ones.
     */
    favoritesState: favoriteGames.ready
      ? ('ready' as const)
      : favoriteGames.failed
        ? ('failed' as const)
        : ('loading' as const),
    retryFavorites: favoriteGames.retry,
    /**
     * Changing the favorites, each saved as it's made. They work from the
     * picks the page shows, so one that was hidden or removed since drops out
     * of what's saved next.
     */
    favoriteActions: {
      reorder: favoriteGames.set,
      remove: (game: { id: number; name: string }) =>
        favoriteGames.remove(game.id, game.name, shownPicks),
      forgetUndo: favoriteGames.forgetUndo,
    },
    /** What the picker needs: the library, the picks, and picking one on or off. */
    favoritePicker: {
      games,
      pickedIds: picked.map((game) => game.id),
      // From the picks as they are this instant, not as last drawn: three
      // quick clicks pick three games, not just the last.
      onToggle: (gameId: number): number[] => {
        const next = toggleFavorite(shownPicks(favoriteGames.current()), gameId);
        favoriteGames.set(next);
        return next;
      },
    },
    /** Changing how the player signs in. */
    account: {
      /** A new email waiting for its confirmation link. */
      pendingEmail: user?.new_email ?? null,
      changePassword,
      changeEmail: async (email: string, password: string) => {
        const result = await changeEmail(email, password);
        // The account has a new email waiting (or a new email): read it again.
        if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
        return result;
      },
      /**
       * Downloads a copy of the player's data, as a file the browser saves.
       * Not offered with no games: there would be nothing in the file but the
       * account's own email.
       */
      downloadData: games.length > 0 ? downloadData : undefined,
      /** Deletes the account; then the page goes to the landing page. */
      deleteAccount: async (password: string) => {
        const result = await deleteAccount(password);
        // A full page load, not the router: the signed-in session and every cached
        // list belonged to the account that's gone.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        if (result.ok) window.location.assign('/');
        return result;
      },
      /** The Steam games that come out of the library when Steam is disconnected. */
      steamGames: games.filter((game) => game.source === 'steam' && !playsOnConsole(game.platform))
        .length,
      /** Unlinks Steam; then the page reloads, with every list as it now is. */
      disconnectSteam: async () => {
        const result = await disconnectSteam();
        if (result.ok) reloadAtTop();
        return result;
      },
      sendPasswordReset: () =>
        user?.email ? sendPasswordReset(user.email) : Promise.resolve(false),
    },
    gameDialog,
    /** Opens a game's dialog, by its id. */
    openGame,
    activity: recentActivity(games, playing),
    // Where the library is played, most games first (then by name), counting
    // what the Games page would list: hidden games aren't counted, and a
    // platform with only hidden games isn't listed.
    platforms: [...countPlatforms(games, 'all')]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
