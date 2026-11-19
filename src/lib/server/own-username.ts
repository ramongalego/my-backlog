import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in player's own username, or null when nobody is signed in. Read
 * once in a request, whoever asks (a layout, its page, the page's metadata).
 */
export const ownUsername = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  // Read from the token: no round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  // Their own row, which is the only one a player can read.
  const { data: own } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle<{ username: string }>();
  return own?.username ?? null;
});
