import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';
import { getSupabaseSecretKey } from '@/lib/server/env';

let serviceClient: SupabaseClient | null = null;

/**
 * For tables users must not write (shared caches, rate-limit counters). Bypasses
 * RLS: trusted server code only, never with user-supplied filters.
 */
function createServiceClient(): SupabaseClient {
  serviceClient ??= createSupabaseClient(SUPABASE_URL, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/** Null when no Supabase secret key is configured. */
export function tryCreateServiceClient(): SupabaseClient | null {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}
