import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { getOpenAIApiKey } from '@/lib/env.server';
import { buildSuggestionPrompt, parseAIResponse, REASONING_STYLE } from '@/lib/suggest/prompt';
import { pickShortlist, scoreCandidates, type HistoryGame } from '@/lib/suggest/shortlist';
import { withoutLaterEntries } from '@/lib/games/series-order';
import type { GameForSuggestion, SuggestionContext } from '@/lib/suggest/types';
import { suggestRequestSchema } from '@/lib/validations/suggest';
import { showsSteamDetails } from '@/lib/games/consoles';

// Compared against gpt-4o-mini and five others on the same prompts: it follows
// the writing rules far more closely and costs about a third less. Its
// reasoning is off: the shortlist is already scored, so it only has to write.
const MODEL = 'gpt-6-luna';
const MAX_ATTEMPTS = 2;
// How much of your history the prompt lists by name.
const MAX_FINISHED_IN_PROMPT = 25;
const MAX_DROPPED_IN_PROMPT = 10;

interface BacklogGame extends GameForSuggestion {
  app_id: number | null;
  header_image: string | null;
  last_played_at: string | null;
  release_date: string | null;
  source: string;
  platform: string | null;
}

interface HistoryRow extends HistoryGame {
  finished_at: string | null;
  dropped_at: string | null;
}

const byNewest = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');

/** Structured output limited to the shortlist, so the model can't name another game. */
function responseFormat(gameIds: number[]) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'suggestion',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          game_id: { type: 'integer', enum: gameIds },
          reasoning: { type: 'string' },
        },
        required: ['game_id', 'reasoning'],
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

  const { mood, energy, time, excludeGameIds, previousReasonings } = parsed.data;
  const preferences = { mood, energy, time };
  const userId = user.id;

  let queuedGames: { game_id: number }[];
  let backlogGames: BacklogGame[];
  let history: HistoryRow[];
  try {
    [queuedGames, backlogGames, history] = await Promise.all([
      fetchAllRows<{ game_id: number }>((from, to) =>
        supabase.from('playing_queue').select('game_id').eq('user_id', userId).range(from, to),
      ),
      fetchAllRows<BacklogGame>((from, to) =>
        supabase
          .from('games')
          .select(
            'id, app_id, source, platform, name, header_image, genres, categories, tags, main_story_hours, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, reroll_count, last_rerolled_at, last_played_at, release_date',
          )
          .eq('user_id', userId)
          .eq('type', 'game')
          .or('status.is.null,status.eq.backlog')
          .order('id')
          .range(from, to),
      ),
      fetchAllRows<HistoryRow>((from, to) =>
        supabase
          .from('games')
          .select('name, status, rating, tags, finished_at, dropped_at')
          .eq('user_id', userId)
          .eq('type', 'game')
          .in('status', ['finished', 'dropped'])
          .order('id')
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

  const excluded = new Set([...excludeGameIds, ...queuedGames.map((q) => q.game_id)]);
  // A sequel waits while the game before it is still in the backlog. This runs
  // on the whole backlog, so a queued or skipped first game still holds it back.
  const ranked = scoreCandidates(
    withoutLaterEntries(backlogGames).filter((g) => !excluded.has(g.id)),
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
  const shortlistIds = shortlist.map((c) => c.game.id);

  // One retry covers a flaky API call or an answer that doesn't parse.
  let suggestedGame: BacklogGame | undefined;
  let reasoning = '';
  let serviceDown = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !suggestedGame; attempt++) {
    let aiResponse: string;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: REASONING_STYLE },
          { role: 'user', content: prompt },
        ],
        reasoning_effort: 'none',
        max_completion_tokens: 300,
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
      suggestedGame = shortlist.find((c) => c.game.id === parsed.game_id)?.game;
      reasoning = parsed.reasoning;
      if (!suggestedGame)
        console.error('AI suggested a game outside the shortlist:', parsed.game_id);
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
        id: suggestedGame.id,
        app_id: suggestedGame.app_id,
        name: suggestedGame.name,
        header_image: suggestedGame.header_image,
        main_story_hours: suggestedGame.main_story_hours,
        genres: suggestedGame.genres,
        tags: suggestedGame.tags,
        // Steam's reviews only for a game played on Steam.
        ...(showsSteamDetails(suggestedGame)
          ? {
              steam_review_score: suggestedGame.steam_review_score,
              steam_review_count: suggestedGame.steam_review_count,
            }
          : { steam_review_score: null, steam_review_count: null }),
        playtime_forever: suggestedGame.playtime_forever ?? 0,
        last_played_at: suggestedGame.last_played_at,
      },
      reasoning,
    },
  });
}
