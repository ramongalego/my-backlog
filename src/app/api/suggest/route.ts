import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { getOpenAIApiKey } from '@/lib/env.server';
import { buildSuggestionPrompt, parseAIResponse } from '@/lib/suggest/prompt';
import type {
  SuggestionPreferences,
  GameForSuggestion,
  FinishedGame,
  SuggestionContext,
  MoodType,
  EnergyLevel,
  TimeCommitment,
} from '@/lib/suggest/types';

const VALID_MOODS: MoodType[] = ['adrenaline', 'relaxed', 'engaged', 'emotional'];
const VALID_ENERGY: EnergyLevel[] = ['high', 'medium', 'low'];
const VALID_TIME: TimeCommitment[] = ['short', 'medium', 'long'];

function validatePreferences(body: unknown): SuggestionPreferences | null {
  if (!body || typeof body !== 'object') return null;

  const { mood, energy, time } = body as Record<string, unknown>;

  if (!VALID_MOODS.includes(mood as MoodType)) return null;
  if (!VALID_ENERGY.includes(energy as EnergyLevel)) return null;
  if (!VALID_TIME.includes(time as TimeCommitment)) return null;

  return { mood, energy, time } as SuggestionPreferences;
}

const MAX_EXCLUDE_APP_IDS = 200;
const MAX_PREVIOUS_REASONINGS = 5;
const MAX_REASONING_LENGTH = 500;

function validateExcludeAppIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
    .slice(0, MAX_EXCLUDE_APP_IDS);
}

export async function POST(request: NextRequest) {
  // Check for API key configuration
  let openaiApiKey: string;
  try {
    openaiApiKey = getOpenAIApiKey();
  } catch {
    return NextResponse.json(
      { success: false, error: 'AI suggestions not configured' },
      { status: 503 },
    );
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`suggestion:${ip}`, RATE_LIMITS.suggestion);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please wait before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  // Authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const preferences = validatePreferences(body);
  if (!preferences) {
    return NextResponse.json({ success: false, error: 'Invalid preferences' }, { status: 400 });
  }

  const excludeAppIds = validateExcludeAppIds((body as Record<string, unknown>).excludeAppIds);
  const rawReasonings = (body as Record<string, unknown>).previousReasonings;
  const previousReasonings = Array.isArray(rawReasonings)
    ? (rawReasonings as unknown[])
        .filter((r): r is string => typeof r === 'string')
        .slice(0, MAX_PREVIOUS_REASONINGS)
        .map((r) => r.slice(0, MAX_REASONING_LENGTH))
    : [];

  // Fetch queued games to exclude from suggestions
  const { data: queuedGames } = await supabase
    .from('playing_queue')
    .select('app_id')
    .eq('user_id', user.id);

  const queuedAppIds = (queuedGames ?? []).map((q) => q.app_id as number);
  const allExcludeAppIds = new Set([...excludeAppIds, ...queuedAppIds]);

  // Fetch user's games
  const { data: backlogGames, error: backlogError } = await supabase
    .from('games')
    .select(
      'app_id, name, genres, categories, tags, main_story_hours, playtime_forever, steam_review_weighted, reroll_count',
    )
    .eq('user_id', user.id)
    .eq('type', 'game')
    .or('status.is.null,status.eq.backlog')
    .order('steam_review_weighted', { ascending: false });

  if (backlogError) {
    console.error('Failed to fetch backlog games:', backlogError);
    return NextResponse.json({ success: false, error: 'Failed to fetch games' }, { status: 500 });
  }

  if (!backlogGames || backlogGames.length === 0) {
    return NextResponse.json({ success: false, error: 'No games in backlog' }, { status: 400 });
  }

  // Fetch finished games with ratings for context
  const { data: finishedGames } = await supabase
    .from('games')
    .select('name, rating')
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .order('finished_at', { ascending: false })
    .limit(30);

  // Fetch dropped games for context
  const { data: droppedGames } = await supabase
    .from('games')
    .select('name')
    .eq('user_id', user.id)
    .eq('status', 'dropped')
    .limit(20);

  // Fetch all games with tags + status to compute tag affinities
  const { data: allGamesForAffinity } = await supabase
    .from('games')
    .select('tags, status')
    .eq('user_id', user.id)
    .eq('type', 'game')
    .not('tags', 'is', null);

  // Compute tag completion rates (min 3 games per tag to filter noise)
  const EXCLUDED_AFFINITY_TAGS = new Set([
    'Singleplayer',
    'Multiplayer',
    'Single-player',
    'Multi-player',
    'Quick-Time Events',
    'Reboot',
  ]);

  const tagStats = new Map<string, { total: number; finished: number }>();
  for (const game of allGamesForAffinity ?? []) {
    for (const tag of (game.tags as string[] | null) ?? []) {
      if (EXCLUDED_AFFINITY_TAGS.has(tag)) continue;
      const stat = tagStats.get(tag) ?? { total: 0, finished: 0 };
      stat.total++;
      if (game.status === 'finished') stat.finished++;
      tagStats.set(tag, stat);
    }
  }

  const tagAffinities = [...tagStats.entries()]
    .filter(([, s]) => s.total >= 3)
    .map(([tag, s]) => ({
      tag,
      completionRate: s.finished / s.total,
      finished: s.finished,
      total: s.total,
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10);

  // Build context for AI
  const context: SuggestionContext = {
    preferences,
    backlogGames: backlogGames.map(
      (g): GameForSuggestion => ({
        app_id: g.app_id,
        name: g.name,
        genres: g.genres,
        categories: g.categories,
        tags: g.tags,
        main_story_hours: g.main_story_hours,
        playtime_forever: g.playtime_forever ?? 0,
        steam_review_weighted: g.steam_review_weighted,
        reroll_count: g.reroll_count ?? 0,
      }),
    ),
    finishedGames:
      finishedGames?.map((g): FinishedGame => ({ name: g.name, rating: g.rating ?? null })) ?? [],
    droppedGames: droppedGames?.map((g) => g.name) ?? [],
    excludeAppIds: allExcludeAppIds,
    previousReasonings,
    tagAffinities,
  };

  // Check if there are any eligible games after exclusions
  const eligibleCount = context.backlogGames.filter((g) => !allExcludeAppIds.has(g.app_id)).length;
  if (eligibleCount === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No more games to suggest. Try with different filters or clear exclusions.',
      },
      { status: 400 },
    );
  }

  // Build prompt and call OpenAI
  let prompt: string;
  try {
    prompt = buildSuggestionPrompt(context);
  } catch (err) {
    Sentry.captureException(err);
    console.error('Failed to build prompt:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to build suggestion request' },
      { status: 500 },
    );
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
    Sentry.captureException(err);
    console.error('OpenAI API error:', err);
    return NextResponse.json(
      { success: false, error: 'AI service temporarily unavailable' },
      { status: 503 },
    );
  }

  // Parse AI response
  let parsedResponse: { app_id: number; reasoning: string };
  try {
    parsedResponse = parseAIResponse(aiResponse);
  } catch (err) {
    Sentry.captureException(err, { extra: { aiResponse } });
    console.error('Failed to parse AI response:', err, aiResponse);
    return NextResponse.json(
      { success: false, error: 'Failed to parse AI suggestion' },
      { status: 500 },
    );
  }

  // Verify the suggested game exists in user's backlog
  const suggestedGame = backlogGames.find((g) => g.app_id === parsedResponse.app_id);
  if (!suggestedGame) {
    console.error('AI suggested non-existent game:', parsedResponse.app_id);
    return NextResponse.json(
      { success: false, error: 'AI suggested an invalid game. Please try again.' },
      { status: 500 },
    );
  }

  // Fetch full game details for response
  const { data: gameDetails } = await supabase
    .from('games')
    .select('app_id, name, header_image, main_story_hours, genres, tags, steam_review_score')
    .eq('user_id', user.id)
    .eq('app_id', parsedResponse.app_id)
    .single();

  return NextResponse.json({
    success: true,
    data: {
      game: gameDetails,
      reasoning: parsedResponse.reasoning,
    },
  });
}
