import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { SHARED_COMPLETION_COLUMNS, type SharedCompletion } from '@/lib/share/completion';

/**
 * Read with the server's key: the table isn't readable through the public API,
 * so share pages are reached only by their unguessable link, never listed.
 * Without the key (development), the visitor's own client reads it.
 */
export async function getSharedCompletion(id: string): Promise<SharedCompletion | null> {
  const client = tryCreateServiceClient() ?? (await createClient());
  const { data, error } = await client
    .from('shared_completions')
    .select(SHARED_COMPLETION_COLUMNS)
    .eq('id', id)
    .maybeSingle<SharedCompletion>();
  if (error) console.error('Failed to read a shared completion:', error);
  return data ?? null;
}
