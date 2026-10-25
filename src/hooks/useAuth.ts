'use client';

import { useEffect } from 'react';
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
    .select('steam_id, steam_username, steam_avatar')
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
