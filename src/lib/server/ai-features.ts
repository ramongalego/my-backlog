import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** What a route answers when the player has turned the AI features off. */
export const AI_OFF_MESSAGE = 'AI features are turned off in Settings';

/**
 * Whether anything of this player's may be sent to OpenAI: false once they
 * turn AI features off on Settings. Every route that calls a model asks this
 * first. When it can't be read the answer is no: the promise is that nothing
 * is sent while it is off, so an unknown is treated as off.
 */
export async function aiFeaturesOn(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('ai_disabled')
    .eq('id', userId)
    .maybeSingle<{ ai_disabled: boolean }>();
  if (error) {
    console.error('Reading whether AI features are on failed:', error);
    return false;
  }
  return data?.ai_disabled === false;
}
