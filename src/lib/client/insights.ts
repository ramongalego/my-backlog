import type { InsightTone } from '@/lib/profile/prompt';
import type { SavedInsight } from '@/lib/profile/saved';

/**
 * The player profile (or its roast) for the signed-in player: written afresh
 * when the library has changed since the saved one, otherwise the saved one.
 */
export async function fetchInsight(tone: InsightTone): Promise<SavedInsight> {
  const res = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tone }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? 'Couldn’t load this right now');
  return body as SavedInsight;
}
