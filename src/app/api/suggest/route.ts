import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { getOpenAIApiKey } from '@/lib/env.server';
import { buildSuggestionPrompt, parseAIResponse } from '@/lib/suggest/prompt';
import type {
  GameForSuggestion,
  FinishedGame,
  SuggestionContext,
  TimeCommitment,
} from '@/lib/suggest/types';
import { suggestRequestSchema } from '@/lib/validations/suggest';

// The highest-rated eligible games sent to the model. Sending the whole backlog
// made prompts tens of thousands of tokens for large libraries.
const MAX_PROMPT_GAMES = 200;

// Pre-filter by time commitment to reduce prompt size.
// Games with unknown hours are always included — let the AI reason about them.
const TIME_MAX_HOURS: Record<TimeCommitment, number | null> = {
  short: 12,
  medium: 20,
  long: null,
};

const EXCLUDED_AFFINITY_TAGS = new Set([
  'Singleplayer',
  'Multiplayer',
  'Single-player',
  'Multi-player',
  'Quick-Time Events',
  'Reboot',
]);

interface BacklogGame {
  app_id: number;
  name: string;
  header_image: string | null;
  genres: string[] | null;
  categories: string[] | null;
  tags: string[] | null;
  main_story_hours: number | null;
  playtime_forever: number | null;
  steam_review_score: number | null;
  steam_review_weighted: number | null;
  reroll_count: number | null;
}

function computeTagAffinities(games: { tags: string[] | null; status: string | null }[]) {
  // Compute tag completion rates (min 3 games per tag to filter noise)
  const tagStats = new Map<string, { total: number; finished: number }>();
  for (const game of games) {
    for (const tag of game.tags ?? []) {
      if (EXCLUDED_AFFINITY_TAGS.has(tag)) continue;
      const stat = tagStats.get(tag) ?? { total: 0, finished: 0 };
      stat.total++;
      if (game.status === 'finished') stat.finished++;
      tagStats.set(tag, stat);
    }
  }

  return [...tagStats.entries()]
    .filter(([, s]) => s.total >= 3)
    .map(([tag, s]) => ({
      tag,
      completionRate: s.finished / s.total,
      finished: s.finished,
      total: s.total,
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10);
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
  let finishedGames: { name: string; rating: number | null }[];
  let droppedGames: { name: string }[];
  let affinityGames: { tags: string[] | null; status: string | null }[];
  try {
    [queuedGames, backlogGames, finishedGames, droppedGames, affinityGames] = await Promise.all([
      fetchAllRows<{ app_id: number }>((from, to) =>
        supabase.from('playing_queue').select('app_id').eq('user_id', userId).range(from, to),
      ),
      fetchAllRows<BacklogGame>((from, to) =>
        supabase
          .from('games')
          .select(
            'app_id, name, header_image, genres, categories, tags, main_story_hours, playtime_forever, steam_review_score, steam_review_weighted, reroll_count',
          )
          .eq('user_id', userId)
          .eq('type', 'game')
          .or('status.is.null,status.eq.backlog')
          .order('steam_review_weighted', { ascending: false, nullsFirst: false })
          .order('app_id')
          .range(from, to),
      ),
      supabase
        .from('games')
        .select('name, rating')
        .eq('user_id', userId)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(30)
        .then(({ data, error }) => {
          if (error) throw error;
          return data ?? [];
        }),
      supabase
        .from('games')
        .select('name')
        .eq('user_id', userId)
        .eq('status', 'dropped')
        .limit(20)
        .then(({ data, error }) => {
          if (error) throw error;
          return data ?? [];
        }),
      fetchAllRows<{ tags: string[] | null; status: string | null }>((from, to) =>
        supabase
          .from('games')
          .select('tags, status')
          .eq('user_id', userId)
          .eq('type', 'game')
          .not('tags', 'is', null)
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

  const allExcludeAppIds = new Set([...excludeAppIds, ...queuedGames.map((q) => q.app_id)]);
  const maxHours = TIME_MAX_HOURS[preferences.time];
  const eligibleGames = backlogGames
    .filter((g) => !allExcludeAppIds.has(g.app_id))
    .filter((g) => !maxHours || g.main_story_hours == null || g.main_story_hours <= maxHours)
    .slice(0, MAX_PROMPT_GAMES);

  if (eligibleGames.length === 0) {
    return jsonError(
      'No more games to suggest. Try with different filters or clear exclusions.',
      400,
    );
  }

  // Build context for AI
  const context: SuggestionContext = {
    preferences,
    backlogGames: eligibleGames.map((g): GameForSuggestion => ({
      app_id: g.app_id,
      name: g.name,
      genres: g.genres,
      categories: g.categories,
      tags: g.tags,
      main_story_hours: g.main_story_hours,
      playtime_forever: g.playtime_forever ?? 0,
      steam_review_weighted: g.steam_review_weighted,
      reroll_count: g.reroll_count ?? 0,
    })),
    finishedGames: finishedGames.map((g): FinishedGame => ({
      name: g.name,
      rating: g.rating ?? null,
    })),
    droppedGames: droppedGames.map((g) => g.name),
    excludeAppIds: allExcludeAppIds,
    previousReasonings,
    tagAffinities: computeTagAffinities(affinityGames),
  };

  // Build prompt and call OpenAI
  let prompt: string;
  try {
    prompt = buildSuggestionPrompt(context);
  } catch (err) {
    console.error('Failed to build prompt:', err);
    return jsonError('Failed to build suggestion request', 500);
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  let aiResponse: string;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    aiResponse = completion.choices[0]?.message?.content ?? '';
  } catch (err) {
    console.error('OpenAI API error:', err);
    return jsonError('AI service temporarily unavailable', 503);
  }

  // Parse AI response
  let parsedResponse: { app_id: number; reasoning: string };
  try {
    parsedResponse = parseAIResponse(aiResponse);
  } catch (err) {
    console.error('Failed to parse AI response:', err, aiResponse);
    return jsonError('Failed to parse AI suggestion', 502);
  }

  // Only accept games that were actually offered: not excluded, not queued,
  // and within the chosen time commitment.
  const suggestedGame = eligibleGames.find((g) => g.app_id === parsedResponse.app_id);
  if (!suggestedGame) {
    console.error('AI suggested a game outside the eligible list:', parsedResponse.app_id);
    return jsonError('AI suggested an invalid game. Please try again.', 502);
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
      },
      reasoning: parsedResponse.reasoning,
    },
  });
}
