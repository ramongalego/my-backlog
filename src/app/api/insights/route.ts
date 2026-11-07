import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { loadGamesList } from '@/lib/data/loaders';
import { factsSignature, hasEnoughForProfile, playerFacts } from '@/lib/profile/facts';
import {
  INSIGHT_RESPONSE_FORMAT,
  buildInsightMessages,
  parseInsight,
  type Insight,
} from '@/lib/profile/prompt';
import { insightRequestSchema } from '@/lib/validations/insights';
import { AI_MODEL } from '@/lib/server/ai-model';
import { jsonError } from '@/lib/server/api-response';
import { getOpenAIApiKey } from '@/lib/server/env';
import { getSavedInsight, saveInsight, type SavedInsight } from '@/lib/server/player-insights';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';

const MAX_ATTEMPTS = 2;

const respond = (insight: SavedInsight) =>
  NextResponse.json({
    headline: insight.headline,
    paragraphs: insight.paragraphs,
    generatedAt: insight.generatedAt,
  });

/**
 * The player profile on Stats, or its roast: what the signed-in player's
 * library says about them. Worked out from their library on the server (never
 * from facts the browser sends), written by the model, and saved: it's only
 * written again when the library changes in a way it talks about. A POST, so
 * the proxy's same-origin check covers it (it can spend OpenAI credit).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const parsed = insightRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid request', 400);
  const { tone } = parsed.data;

  let games;
  try {
    games = await loadGamesList(supabase, user.id);
  } catch (err) {
    console.error('Failed to load the library for a player profile:', err);
    return jsonError('Failed to load your library', 500);
  }
  const facts = hasEnoughForProfile(games) ? playerFacts(games) : null;
  if (!facts) return jsonError('Not enough in your library yet', 422);

  const signature = factsSignature(facts);
  const saved = await getSavedInsight(user.id, tone);
  if (saved?.signature === signature) return respond(saved);

  // Writing a new one: limited per player and overall. Past a limit, the last
  // one written is better than nothing.
  const limit = await checkSharedRateLimit(`insights:${user.id}`, RATE_LIMITS.insights);
  const global = limit.success
    ? await checkSharedRateLimit('insights:global', RATE_LIMITS.insightsGlobal)
    : limit;
  if (!limit.success || !global.success) {
    if (saved) return respond(saved);
    return jsonError('Try again tomorrow: today’s profiles have all been written.', 429);
  }

  let apiKey: string;
  try {
    apiKey = getOpenAIApiKey();
  } catch {
    return jsonError('Player profiles are not configured', 503);
  }
  const openai = new OpenAI({ apiKey });

  let insight: Insight | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !insight; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: buildInsightMessages(facts, tone),
        reasoning_effort: 'none',
        max_completion_tokens: 700,
        response_format: INSIGHT_RESPONSE_FORMAT,
      });
      insight = parseInsight(completion.choices[0]?.message?.content ?? '');
      if (!insight) console.error(`Unusable player profile (attempt ${attempt})`);
    } catch (err) {
      console.error(`OpenAI error writing a player profile (attempt ${attempt}):`, err);
    }
  }
  if (!insight) {
    if (saved) return respond(saved);
    return jsonError('Couldn’t write it right now. Try again in a moment.', 503);
  }

  await saveInsight(user.id, tone, insight, signature);
  return respond({ ...insight, signature, generatedAt: new Date().toISOString() });
}
