import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { buildSuggestionPrompt, parseAIResponse } from '@/lib/suggest/prompt';
import type {
  SuggestionPreferences,
  GameForSuggestion,
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

function validateExcludeAppIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number =>
    typeof id === 'number' && Number.isInteger(id) && id > 0
  );
}

export async function POST(request: NextRequest) {
  // Check for API key configuration
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'AI suggestions not configured' },
      { status: 503 }
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
      }
    );
  }

  // Authentication
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const preferences = validatePreferences(body);
  if (!preferences) {
    return NextResponse.json(
      { success: false, error: 'Invalid preferences' },
      { status: 400 }
    );
  }

  const excludeAppIds = validateExcludeAppIds((body as Record<string, unknown>).excludeAppIds);
  const previousReasonings = Array.isArray((body as Record<string, unknown>).previousReasonings)
    ? ((body as Record<string, unknown>).previousReasonings as string[]).filter(r => typeof r === 'string')
    : [];

  // Fetch user's games
  const { data: backlogGames, error: backlogError } = await supabase
    .from('games')
    .select('app_id, name, genres, categories, main_story_hours, playtime_forever, steam_review_weighted, reroll_count')
    .eq('user_id', user.id)
    .eq('type', 'game')
    .or('status.is.null,status.eq.backlog')
    .contains('categories', ['Single-player'])
    .order('steam_review_weighted', { ascending: false });

  if (backlogError) {
    console.error('Failed to fetch backlog games:', backlogError);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch games' },
      { status: 500 }
    );
  }

  if (!backlogGames || backlogGames.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No games in backlog' },
      { status: 400 }
    );
  }

  // Fetch finished games for context
  const { data: finishedGames } = await supabase
    .from('games')
    .select('name')
    .eq('user_id', user.id)
    .eq('status', 'finished')
    .limit(20);

  // Fetch dropped games for context
  const { data: droppedGames } = await supabase
    .from('games')
    .select('name')
    .eq('user_id', user.id)
    .eq('status', 'dropped')
    .limit(20);

  // Build context for AI
  const context: SuggestionContext = {
    preferences,
    backlogGames: backlogGames.map((g): GameForSuggestion => ({
      app_id: g.app_id,
      name: g.name,
      genres: g.genres,
      categories: g.categories,
      main_story_hours: g.main_story_hours,
      playtime_forever: g.playtime_forever ?? 0,
      steam_review_weighted: g.steam_review_weighted,
      reroll_count: g.reroll_count ?? 0,
    })),
    finishedGames: finishedGames?.map(g => g.name) ?? [],
    droppedGames: droppedGames?.map(g => g.name) ?? [],
    excludeAppIds,
    previousReasonings,
  };

  // Check if there are any eligible games after exclusions
  const eligibleCount = context.backlogGames.filter(g => !excludeAppIds.includes(g.app_id)).length;
  if (eligibleCount === 0) {
    return NextResponse.json(
      { success: false, error: 'No more games to suggest. Try with different filters or clear exclusions.' },
      { status: 400 }
    );
  }

  // Build prompt and call OpenAI
  let prompt: string;
  try {
    prompt = buildSuggestionPrompt(context);
  } catch (err) {
    console.error('Failed to build prompt:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to build suggestion request' },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    return NextResponse.json(
      { success: false, error: 'AI service temporarily unavailable' },
      { status: 503 }
    );
  }

  // Parse AI response
  let parsedResponse: { app_id: number; reasoning: string };
  try {
    parsedResponse = parseAIResponse(aiResponse);
  } catch (err) {
    console.error('Failed to parse AI response:', err, aiResponse);
    return NextResponse.json(
      { success: false, error: 'Failed to parse AI suggestion' },
      { status: 500 }
    );
  }

  // Verify the suggested game exists in user's backlog
  const suggestedGame = backlogGames.find(g => g.app_id === parsedResponse.app_id);
  if (!suggestedGame) {
    console.error('AI suggested non-existent game:', parsedResponse.app_id);
    return NextResponse.json(
      { success: false, error: 'AI suggested an invalid game. Please try again.' },
      { status: 500 }
    );
  }

  // Fetch full game details for response
  const { data: gameDetails } = await supabase
    .from('games')
    .select('app_id, name, header_image, main_story_hours, genres')
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
