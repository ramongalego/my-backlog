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

export function useAuth() {
  const queryClient = useQueryClient();

  const { data = EMPTY_SESSION, isPending } = useQuery({
    queryKey: queryKeys.auth.session(),
    queryFn: fetchAuthSession,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        queryClient.setQueryData(queryKeys.auth.session(), EMPTY_SESSION);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
      }
      // TOKEN_REFRESHED / INITIAL_SESSION: user+profile unchanged, skip refetch.
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    user: data.user,
    profile: data.profile,
    authResolved: !isPending,
  };
}
