'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queries } from '@/lib/data/queries';
import { useAuth, useUpdateSessionProfile } from '@/hooks/useAuth';
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
import {
  removeAvatar,
  saveAiFeatures,
  saveProfileName,
  saveProfilePrivacy,
  saveUsername,
  squareAvatar,
  uploadAvatar,
} from '@/lib/client/profile-identity';
import { displayName, memberSince, profileAvatar, profileName } from '@/lib/account/identity';
import { playsOnConsole } from '@/lib/games/consoles';
import { reloadAtTop } from '@/lib/reload';
import type { ApiResult } from '@/lib/client/request';
import type { Profile } from '@/types/games';
import { useInFlight } from './useInFlight';
import { useLibraryMeta } from './useLibraryMeta';

/**
 * The account comes with the session, so the page never waits. Only two things
 * need the library (the Games page's cached list): whether there's anything to
 * export, and how many games leave with Steam.
 */
export function useSettingsPage() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const { data: games, isSuccess: libraryKnown } = useQuery(queries.gamesList(userId));
  // Until the library arrives, the count the header already has.
  const { gameCount } = useLibraryMeta(userId);
  const hasGames = libraryKnown ? games.length > 0 : gameCount > 0;
  // Until the database has said (or if it can't), how the account was made.
  const { data: hasPassword } = useQuery(queries.hasPassword(userId));
  // A saved change goes into the session the whole app reads, so the header's
  // menu and the Profile page show the new name or picture at once too.
  const updateProfile = useUpdateSessionProfile();
  const inFlight = useInFlight();
  /**
   * A yes-or-no setting on the profile: shown at once, and put back with a
   * toast if it couldn't be saved. One change at a time: a second press while
   * one is on its way would race it.
   */
  const toggle =
    (
      key: string,
      shown: (value: boolean) => Partial<Profile>,
      save: (value: boolean) => Promise<ApiResult<unknown>>,
    ) =>
    (value: boolean) =>
      inFlight.once(key, async () => {
        updateProfile(shown(value));
        const result = await save(value);
        if (!result.ok) {
          updateProfile(shown(!value));
          toast.error(result.error);
        }
      });

  return {
    /** What the profile shows of the player, and who can see it. */
    profile: {
      name: profileName(profile?.display_name, profile?.steam_username, user?.email),
      /** The name the player chose, or null when it's the account's. */
      chosenName: profile?.display_name ?? null,
      /** What the name goes back to when the chosen one is cleared. */
      accountName: displayName(profile?.steam_username, user?.email),
      avatar: profileAvatar(profile?.avatar_url, profile?.steam_avatar),
      hasOwnPicture: !!profile?.avatar_url,
      rename: async (name: string | null) => {
        const result = await saveProfileName(name);
        // A failure is said under the field, where the name is being typed.
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
      /** Null until the profile is read. */
      isPrivate: profile?.is_private ?? null,
      setPrivate: toggle(
        'profile-privacy',
        (isPrivate) => ({ is_private: isPrivate }),
        saveProfilePrivacy,
      ),
    },
    /** Pick My Game's questions, and the profile and roast on Stats. */
    ai: {
      /** Null until the profile is read. */
      enabled: profile ? !profile.ai_disabled : null,
      setEnabled: toggle('ai-features', (enabled) => ({ ai_disabled: !enabled }), saveAiFeatures),
    },
    username: profile?.username ?? null,
    changeUsername: async (username: string) => {
      const result = await saveUsername(username);
      if (result.ok) updateProfile({ username: result.username });
      return result;
    },
    email: user?.email ?? null,
    /** "January 2026": when the account was made, or null when that isn't known. */
    memberSince: memberSince(user?.created_at),
    /** A new email waiting for its confirmation link. */
    pendingEmail: user?.new_email ?? null,
    /** One made with Google or Discord has no password until it sets one. */
    signIn: {
      hasPassword: hasPassword ?? signedUpWithPassword(user),
      providers: linkedProviders(user),
    },
    changePassword,
    changeEmail: async (email: string, password: string) => {
      const result = await changeEmail(email, password);
      // Reread the session for the pending (or new) email.
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
      return result;
    },
    sendPasswordReset: () => (user?.email ? sendPasswordReset(user.email) : Promise.resolve(false)),
    steam: profile?.steam_id ? { username: profile.steam_username } : null,
    /**
     * The Steam games that come out of the library when Steam is disconnected;
     * null while the library isn't known.
     */
    steamGames: libraryKnown
      ? games.filter((game) => game.source === 'steam' && !playsOnConsole(game.platform)).length
      : null,
    /** Unlinks Steam; then the page reloads, with every list as it now is. */
    disconnectSteam: async () => {
      const result = await disconnectSteam();
      if (result.ok) reloadAtTop();
      return result;
    },
    /** Not offered with no games: the file would hold only the account's email. */
    downloadData: hasGames ? downloadData : undefined,
    /** Deletes the account; then the page goes to the landing page. */
    deleteAccount: async (proof: DeleteProof) => {
      const result = await deleteAccount(proof);
      // A full page load, not the router: the signed-in session and every cached
      // list belonged to the account that's gone.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (result.ok) window.location.assign('/');
      return result;
    },
  };
}
