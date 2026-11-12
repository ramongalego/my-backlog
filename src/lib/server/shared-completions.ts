import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { SHARED_COMPLETION_COLUMNS, type SharedCompletion } from '@/lib/share/completion';

/**
 * One share page's row, by its id. Read with the server's key: the table isn't
 * readable through the public API, so share pages can only be reached by their
 * unguessable link, never listed. (Without the key, in development, it falls
 * back to the visitor's own client.)
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
