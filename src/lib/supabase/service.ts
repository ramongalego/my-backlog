import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';
import { getSupabaseSecretKey } from '@/lib/env.server';

let serviceClient: SupabaseClient | null = null;

/**
 * Secret-key client for server-only writes to tables users must not write
 * to directly (shared caches, rate-limit counters). Bypasses RLS, so only use
 * it from trusted server code, never with user-supplied filters.
 */
export function createServiceClient(): SupabaseClient {
  serviceClient ??= createSupabaseClient(SUPABASE_URL, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/** The service client, or null when no Supabase secret key is configured. */
export function tryCreateServiceClient(): SupabaseClient | null {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}
