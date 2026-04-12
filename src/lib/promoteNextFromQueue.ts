import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameWithImage } from '@/types/games';

export async function promoteNextFromQueue(
  userId: string,
  supabase: SupabaseClient,
): Promise<GameWithImage | null> {
  // Get the lowest-position item in the queue
  const { data: topItem } = await supabase
    .from('playing_queue')
    .select('app_id, position')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!topItem) return null;

  const appId = topItem.app_id;

  // Promote to playing
  const promoteRes = await fetch('/api/games/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, status: 'playing' }),
  });
  if (!promoteRes.ok) {
    throw new Error(`Failed to promote queued game (${promoteRes.status})`);
  }

  // Remove from queue
  const removeRes = await fetch(`/api/queue?appId=${appId}`, { method: 'DELETE' });
  if (!removeRes.ok) {
    throw new Error(`Failed to remove promoted game from queue (${removeRes.status})`);
  }

  // Fetch game details to return
  const { data: game } = await supabase
    .from('games')
    .select('app_id, name, header_image, main_story_hours, playtime_forever, started_at')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .maybeSingle();

  return game ?? null;
}
