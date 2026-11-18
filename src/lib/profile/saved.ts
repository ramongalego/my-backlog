// Apart from prompt.ts so the browser can tell a saved profile is out of date
// without downloading the prompts.
import { factsSignature, type PlayerFacts } from './facts';
import type { Insight, InsightTone } from './prompt';

// Raised when the prompts change, so profiles written with the old ones read as
// out of date.
const PROMPT_VERSION = 6;

/** What a saved profile was written from: the facts and the prompt. */
export function insightSignature(facts: PlayerFacts): string {
  return `v${PROMPT_VERSION}:${factsSignature(facts)}`;
}

/** The last profile or roast written for a player. */
export interface SavedInsight extends Insight {
  signature: string;
  generatedAt: string;
}

/** Null for a tone never written. */
export type SavedInsights = Record<InsightTone, SavedInsight | null>;

/** "November 18", or "November 18, 2025" for a day in another year. */
export function writtenOn(generatedAt: string, now = new Date()): string {
  const date = new Date(generatedAt);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
