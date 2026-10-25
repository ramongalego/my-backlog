import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * The signed-in user's id from the locally stored session, without the network
 * round trip `getUser()` makes. Only used to scope queries; access is still
 * enforced server-side by RLS.
 */
export async function getSessionUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.user.id ?? null;
}
