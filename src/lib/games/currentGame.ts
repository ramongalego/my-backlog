import { createClient } from '@/lib/supabase/client';
import type { GameWithImage } from '@/types/games';

export const PLAYING_GAME_SELECT =
  'app_id, name, header_image, main_story_hours, playtime_forever, started_at, steam_review_score, deck_compat';

export async function fetchCurrentlyPlaying(userId: string): Promise<GameWithImage | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('games')
    .select(PLAYING_GAME_SELECT)
    .eq('user_id', userId)
    .eq('status', 'playing')
    .single();
  return data ?? null;
}
