import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { parseSteamInput, getPlayerSummary, getOwnedGames } from '@/lib/steam/api';
import { getSteamSpyTags } from '@/lib/steam/store-api';
import { getSteamApiKey, getOpenAIApiKey } from '@/lib/env.server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { buildRoastPrompt } from '@/lib/roast/prompt';

export async function POST(request: NextRequest) {
  // Check API keys
  let steamApiKey: string;
  let openaiApiKey: string;
  try {
    steamApiKey = getSteamApiKey();
    openaiApiKey = getOpenAIApiKey();
  } catch {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`roast:${ip}`, RATE_LIMITS.roast);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many roasts — try again later' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  // Parse input
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { steamInput } = body;
  if (!steamInput || typeof steamInput !== 'string' || steamInput.trim().length === 0) {
    return NextResponse.json({ error: 'Steam URL or username is required' }, { status: 400 });
  }

  // Resolve to Steam ID
  const steamId = await parseSteamInput(steamInput, steamApiKey);
  if (!steamId) {
    return NextResponse.json(
      {
        error:
          'Could not find that Steam profile. Try pasting the full profile URL from your browser — display names and vanity URLs are not the same thing.',
      },
      { status: 404 },
    );
  }

  // Fetch Steam data
  let profile;
  let games;
  try {
    [profile, games] = await Promise.all([
      getPlayerSummary(steamId, steamApiKey),
      getOwnedGames(steamId, steamApiKey),
    ]);
  } catch {
    return NextResponse.json(
      { error: 'Could not fetch Steam data. The profile may be private.' },
      { status: 502 },
    );
  }

  if (!profile) {
    return NextResponse.json({ error: 'Steam profile not found' }, { status: 404 });
  }

  if (games.length === 0) {
    return NextResponse.json(
      { error: 'This profile has no games or the game library is set to private.' },
      { status: 422 },
    );
  }

  // Fetch tags for top 10 most-played games
  const top10 = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);
  const tagResults = await Promise.all(top10.map((g) => getSteamSpyTags(g.appid)));

  const tagCounts = new Map<string, number>();
  for (const tags of tagResults) {
    if (!tags) continue;
    // Only count top 5 tags per game to avoid noise
    for (const tag of tags.slice(0, 5)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  // Build prompt and call OpenAI
  const prompt = buildRoastPrompt(profile, games, topTags);
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 1000,
    });

    const roast = completion.choices[0]?.message?.content ?? '';

    return NextResponse.json({
      roast,
      profile: {
        name: profile.personaname,
        avatar: profile.avatarfull,
        profileUrl: profile.profileurl,
      },
      stats: {
        totalGames: games.length,
        totalHours: Math.round(games.reduce((sum, g) => sum + g.playtime_forever, 0) / 60),
        neverPlayed: games.filter((g) => g.playtime_forever === 0).length,
      },
    });
  } catch (err) {
    console.error('OpenAI API error:', err);
    return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 503 });
  }
}
