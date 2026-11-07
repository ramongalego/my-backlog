import 'server-only';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import type { Insight, InsightTone } from '@/lib/profile/prompt';

/** A written profile as saved: with the facts it was written from (their signature). */
export interface SavedInsight extends Insight {
  signature: string;
  generatedAt: string;
}

// Saved in player_insights, which only the server writes (with the secret
// key): users read their own rows, but can't put words in the app's mouth.
// Saving is best effort: without the table or the key the profile is still
// written, just not kept.

export async function getSavedInsight(
  userId: string,
  tone: InsightTone,
): Promise<SavedInsight | null> {
  const db = tryCreateServiceClient();
  if (!db) return null;
  const { data, error } = await db
    .from('player_insights')
    .select('headline, paragraphs, signature, generated_at')
    .eq('user_id', userId)
    .eq('tone', tone)
    .maybeSingle();
  if (error) {
    console.error('Failed to read a saved player profile:', error.message);
    return null;
  }
  if (!data) return null;
  return {
    headline: data.headline,
    paragraphs: data.paragraphs,
    signature: data.signature,
    generatedAt: data.generated_at,
  };
}

export async function saveInsight(
  userId: string,
  tone: InsightTone,
  insight: Insight,
  signature: string,
): Promise<void> {
  const db = tryCreateServiceClient();
  if (!db) return;
  const { error } = await db.from('player_insights').upsert({
    user_id: userId,
    tone,
    headline: insight.headline,
    paragraphs: insight.paragraphs,
    signature,
    generated_at: new Date().toISOString(),
  });
  if (error) console.error('Failed to save a player profile:', error.message);
}
