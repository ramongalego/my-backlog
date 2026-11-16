'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import type { Profile } from '@/types/games';

interface AuthSession {
  user: User | null;
  profile: Profile | null;
}

const EMPTY_SESSION: AuthSession = { user: null, profile: null };

async function fetchAuthSession(): Promise<AuthSession> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY_SESSION;

  const { data: profile } = await supabase
    .from('profiles')
    .select('steam_id, steam_username, steam_avatar, display_name, avatar_url')
    .eq('id', user.id)
    .single();

  return { user, profile: profile ?? null };
}

/**
 * Keeps the cached session in sync with Supabase auth events. Mounted once in
 * the app Providers rather than in every useAuth() caller.
 */
export function AuthStateListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const key = queryKeys.auth.session();
      if (event === 'SIGNED_OUT' || !session?.user) {
        queryClient.setQueryData(key, EMPTY_SESSION);
        return;
      }
      // Supabase also emits SIGNED_IN on page load and tab refocus for the
      // already signed-in user; only refetch when the user actually changed.
      const cachedUserId = queryClient.getQueryData<AuthSession>(key)?.user?.id;
      if (event === 'SIGNED_IN' && cachedUserId === session.user.id) return;
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: key });
      }
      // TOKEN_REFRESHED / INITIAL_SESSION: user+profile unchanged, skip refetch.
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return null;
}

/**
 * Changes the profile in the signed-in session the whole app reads (header,
 * Profile page), for a change the server has just saved: no refetch needed.
 */
export function useUpdateSessionProfile() {
  const queryClient = useQueryClient();
  // Memoized by hand: it's a dependency of the library refresh's callback,
  // which an effect re-runs on, and that shouldn't hang on the compiler.
  return useCallback(
    (change: Partial<Profile>) => {
      const key = queryKeys.auth.session();
      // A read of the session on its way was made before this change, and
      // would put the old profile back over it.
      void queryClient.cancelQueries({ queryKey: key }, { revert: false });
      queryClient.setQueryData<AuthSession>(
        key,
        (session) =>
          session && {
            ...session,
            profile: {
              steam_id: null,
              steam_username: null,
              steam_avatar: null,
              display_name: null,
              avatar_url: null,
              ...session.profile,
              ...change,
            },
          },
      );
    },
    [queryClient],
  );
}

export function useAuth() {
  const { data = EMPTY_SESSION, isPending } = useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: fetchAuthSession,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    user: data.user,
    profile: data.profile,
    authResolved: !isPending,
  };
}
