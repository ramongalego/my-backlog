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
import { linkedProviders, signedUpWithPassword } from '@/lib/account/sign-in';
import { queryKeys } from '@/lib/query-keys';
import {
  changeEmail,
  changePassword,
  deleteAccount,
  disconnectSteam,
  downloadData,
  sendPasswordReset,
  type DeleteProof,
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

/** The library is the Games page's cached list, so it's downloaded once. */
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
  // If it can't be read, Recent activity falls back to what the games say.
  const { data: history = [] } = useQuery(queries.history(userId));
  // Until the database has said (or if it can't), how the account was made.
  const { data: hasPassword } = useQuery(queries.hasPassword(userId));

  // The favorites are the player's to pick: none until they do.
  const favoriteGames = useFavoriteGames(userId);
  const picked = pickedFavorites(games, favoriteGames.pickedIds);
  /** The picks the page shows: one hidden since, or gone from the library, drops out. */
  const shownPicks = (ids: readonly number[]) => pickedFavorites(games, ids).map((game) => game.id);
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
    identity: {
      /** The name the player chose, or null when it's the account's. */
      chosenName: profile?.display_name ?? null,
      /** What the name goes back to when the chosen one is cleared. */
      accountName: displayName(profile?.steam_username, user?.email),
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
     * Until 'ready' the row can't be changed: drawn empty, it would invite
     * picking over the saved ones.
     */
    favoritesState: favoriteGames.ready
      ? ('ready' as const)
      : favoriteGames.failed
        ? ('failed' as const)
        : ('loading' as const),
    retryFavorites: favoriteGames.retry,
    /** Built on the picks the page shows, so one hidden or removed since drops out. */
    favoriteActions: {
      reorder: favoriteGames.set,
      remove: (game: { id: number; name: string }) =>
        favoriteGames.remove(game.id, game.name, shownPicks),
      forgetUndo: favoriteGames.forgetUndo,
    },
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
    account: {
      /** One made with Google or Discord has no password until it sets one. */
      signIn: {
        hasPassword: hasPassword ?? signedUpWithPassword(user),
        providers: linkedProviders(user),
      },
      /** A new email waiting for its confirmation link. */
      pendingEmail: user?.new_email ?? null,
      changePassword,
      changeEmail: async (email: string, password: string) => {
        const result = await changeEmail(email, password);
        // Reread the session for the pending (or new) email.
        if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
        return result;
      },
      /** Not offered with no games: the file would hold only the account's email. */
      downloadData: games.length > 0 ? downloadData : undefined,
      /** Deletes the account; then the page goes to the landing page. */
      deleteAccount: async (proof: DeleteProof) => {
        const result = await deleteAccount(proof);
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
    openGame,
    activity: recentActivity(games, playing, history),
    // Counted as the Games page lists them: hidden games don't count, and a
    // platform with only hidden games isn't listed.
    platforms: [...countPlatforms(games, 'all')]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
