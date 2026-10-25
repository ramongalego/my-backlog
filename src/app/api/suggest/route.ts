import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { getOpenAIApiKey } from '@/lib/env.server';
import { buildSuggestionPrompt, parseAIResponse } from '@/lib/suggest/prompt';
import { pickShortlist, scoreCandidates, type HistoryGame } from '@/lib/suggest/shortlist';
import type { GameForSuggestion, SuggestionContext } from '@/lib/suggest/types';
import { suggestRequestSchema } from '@/lib/validations/suggest';

const MODEL = 'gpt-4o-mini';
const MAX_ATTEMPTS = 2;
// How much of your history the prompt lists by name.
const MAX_FINISHED_IN_PROMPT = 25;
const MAX_DROPPED_IN_PROMPT = 10;

interface BacklogGame extends GameForSuggestion {
  header_image: string | null;
}

interface HistoryRow extends HistoryGame {
  finished_at: string | null;
  dropped_at: string | null;
}

const byNewest = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');

/** Structured output limited to the shortlist, so the model can't name another game. */
function responseFormat(appIds: number[]) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'suggestion',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          app_id: { type: 'integer', enum: appIds },
          reasoning: { type: 'string' },
        },
        required: ['app_id', 'reasoning'],
        additionalProperties: false,
      },
    },
  };
}

export async function POST(request: NextRequest) {
  // Check for API key configuration
  let openaiApiKey: string;
  try {
    openaiApiKey = getOpenAIApiKey();
  } catch {
    return jsonError('AI suggestions not configured', 503);
  }

  // Authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  // Rate limiting per user (not IP) — authenticated endpoint, so each user gets
  // their own OpenAI quota and shared NATs don't throttle each other.
  const rateLimitResult = await checkSharedRateLimit(
    `suggestion:${user.id}`,
    RATE_LIMITS.suggestion,
  );
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = suggestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid preferences', 400);
  }

  const { mood, energy, time, excludeAppIds, previousReasonings } = parsed.data;
  const preferences = { mood, energy, time };
  const userId = user.id;

  let queuedGames: { app_id: number }[];
  let backlogGames: BacklogGame[];
  let history: HistoryRow[];
  try {
    [queuedGames, backlogGames, history] = await Promise.all([
      fetchAllRows<{ app_id: number }>((from, to) =>
        supabase.from('playing_queue').select('app_id').eq('user_id', userId).range(from, to),
      ),
      fetchAllRows<BacklogGame>((from, to) =>
        supabase
          .from('games')
          .select(
            'app_id, name, header_image, genres, categories, tags, main_story_hours, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, reroll_count, last_rerolled_at',
          )
          .eq('user_id', userId)
          .eq('type', 'game')
          .or('status.is.null,status.eq.backlog')
          .order('app_id')
          .range(from, to),
      ),
      fetchAllRows<HistoryRow>((from, to) =>
        supabase
          .from('games')
          .select('name, status, rating, tags, finished_at, dropped_at')
          .eq('user_id', userId)
          .eq('type', 'game')
          .in('status', ['finished', 'dropped'])
          .order('app_id')
          .range(from, to),
      ),
    ]);
  } catch (err) {
    console.error('Failed to load games for suggestion:', err);
    return jsonError('Failed to fetch games', 500);
  }

  if (backlogGames.length === 0) {
    return jsonError('No games in backlog', 400);
  }

  const excluded = new Set([...excludeAppIds, ...queuedGames.map((q) => q.app_id)]);
  const ranked = scoreCandidates(
    backlogGames.filter((g) => !excluded.has(g.app_id)),
    history,
    preferences,
  );
  const shortlist = pickShortlist(ranked);

  if (shortlist.length === 0) {
    return jsonError(
      'No more games to suggest. Try with different filters or clear exclusions.',
      400,
    );
  }

  const finished = history.filter((h) => h.status === 'finished');
  const context: SuggestionContext = {
    preferences,
    candidates: shortlist,
    // Rated games first (best first), then the most recent unrated ones.
    finishedGames: [
      ...finished
        .filter((h) => h.rating != null)
        .sort((a, b) => b.rating! - a.rating! || byNewest(a.finished_at, b.finished_at)),
      ...finished
        .filter((h) => h.rating == null)
        .sort((a, b) => byNewest(a.finished_at, b.finished_at)),
    ]
      .slice(0, MAX_FINISHED_IN_PROMPT)
      .map((h) => ({ name: h.name, rating: h.rating })),
    droppedGames: history
      .filter((h) => h.status === 'dropped')
      .sort((a, b) => byNewest(a.dropped_at, b.dropped_at))
      .slice(0, MAX_DROPPED_IN_PROMPT)
      .map((h) => h.name),
    previousReasonings,
  };

  let prompt: string;
  try {
    prompt = buildSuggestionPrompt(context);
  } catch (err) {
    console.error('Failed to build prompt:', err);
    return jsonError('Failed to build suggestion request', 500);
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const shortlistIds = shortlist.map((c) => c.game.app_id);

  // One retry covers a flaky API call or an answer that doesn't parse.
  let suggestedGame: BacklogGame | undefined;
  let reasoning = '';
  let serviceDown = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !suggestedGame; attempt++) {
    let aiResponse: string;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
        response_format: responseFormat(shortlistIds),
      });
      aiResponse = completion.choices[0]?.message?.content ?? '';
      serviceDown = false;
    } catch (err) {
      console.error(`OpenAI API error (attempt ${attempt}):`, err);
      serviceDown = true;
      continue;
    }

    try {
      const parsed = parseAIResponse(aiResponse);
      suggestedGame = shortlist.find((c) => c.game.app_id === parsed.app_id)?.game;
      reasoning = parsed.reasoning;
      if (!suggestedGame)
        console.error('AI suggested a game outside the shortlist:', parsed.app_id);
    } catch (err) {
      console.error(`Failed to parse AI response (attempt ${attempt}):`, err, aiResponse);
    }
  }

  if (!suggestedGame) {
    return serviceDown
      ? jsonError('AI service temporarily unavailable', 503)
      : jsonError("Couldn't get a suggestion. Please try again.", 502);
  }

  return NextResponse.json({
    success: true,
    data: {
      game: {
        app_id: suggestedGame.app_id,
        name: suggestedGame.name,
        header_image: suggestedGame.header_image,
        main_story_hours: suggestedGame.main_story_hours,
        genres: suggestedGame.genres,
        tags: suggestedGame.tags,
        steam_review_score: suggestedGame.steam_review_score,
        steam_review_count: suggestedGame.steam_review_count,
      },
      reasoning,
    },
  });
}
