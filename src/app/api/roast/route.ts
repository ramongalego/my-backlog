import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import OpenAI from 'openai';
import {
  parseSteamInput,
  getPlayerSummary,
  getOwnedGames,
  getPlayerBans,
  getSteamLevel,
  getWishlistCount,
} from '@/lib/steam/api';
import { getSteamTags } from '@/lib/steam/store-api';
import { getSteamApiKey, getOpenAIApiKey } from '@/lib/env.server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { buildRoastPrompt } from '@/lib/roast/prompt';
import { getCachedRoast, setCachedRoast } from '@/lib/roast/cache';
import { getBlacklistMessage } from '@/lib/roast/blacklist';
import { roastRequestSchema } from '@/lib/validations/roast';
import { jsonError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  // Check API keys
  let steamApiKey: string;
  let openaiApiKey: string;
  try {
    steamApiKey = getSteamApiKey();
    openaiApiKey = getOpenAIApiKey();
  } catch {
    return jsonError('Service not configured', 503);
  }

  // Parse input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = roastRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  }
  const { steamInput } = parsed.data;

  // Check blacklist before any API calls
  const blacklistMessage = getBlacklistMessage(steamInput);
  if (blacklistMessage) {
    return NextResponse.json({ blacklisted: true, message: blacklistMessage });
  }

  // Resolve to Steam ID
  const steamId = await parseSteamInput(steamInput, steamApiKey);
  if (!steamId) {
    return jsonError(
      'Could not find that Steam profile. Try pasting the full profile URL from your browser, display names and vanity URLs are not the same thing.',
      404,
    );
  }

  // Return cached result if available (no rate limit cost)
  const cached = getCachedRoast(steamId);
  if (cached) return NextResponse.json(cached);

  // Rate limit only when we need to generate a new roast
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`roast:${ip}`, RATE_LIMITS.roast);

  if (!rateLimitResult.success) {
    return jsonError('Too many roasts. Try again later.', 429, {
      'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
    });
  }

  // Global circuit breaker on fresh generations — bounds worst-case OpenAI spend
  // even if per-IP limits are bypassed by a distributed attacker. Cache hits above
  // already skipped this check.
  const globalLimit = checkRateLimit('roast:global', RATE_LIMITS.roastGlobal);
  if (!globalLimit.success) {
    return jsonError('Roasts are temporarily unavailable. Try again tomorrow.', 429);
  }

  // Fetch Steam data — all in parallel
  let profile;
  let games;
  let bans;
  let steamLevel;
  let wishlistCount;
  try {
    [profile, games, bans, steamLevel, wishlistCount] = await Promise.all([
      getPlayerSummary(steamId, steamApiKey),
      getOwnedGames(steamId, steamApiKey),
      getPlayerBans(steamId, steamApiKey),
      getSteamLevel(steamId, steamApiKey),
      getWishlistCount(steamId),
    ]);
  } catch (err) {
    Sentry.captureException(err);
    return jsonError('Could not fetch Steam data. The profile may be private.', 502);
  }

  if (!profile) {
    return jsonError('Steam profile not found', 404);
  }

  if (games.length === 0) {
    return jsonError('This profile has no games or the game library is set to private.', 422);
  }

  // Fetch tags for top 10 most-played games
  const top10 = [...games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 10);
  const tagResults = await Promise.all(top10.map((g) => getSteamTags(g.appid)));

  const tagCounts = new Map<string, number>();
  for (const tags of tagResults) {
    if (!tags) continue;
    for (const tag of tags.slice(0, 5)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  // Build prompt and call OpenAI
  const prompt = buildRoastPrompt(profile, games, topTags, {
    bans,
    steamLevel,
    wishlistCount,
  });
  const openai = new OpenAI({ apiKey: openaiApiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
    });

    const roast = completion.choices[0]?.message?.content ?? '';

    const response = {
      roast,
      steamId,
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
    };

    setCachedRoast(steamId, response);

    return NextResponse.json(response);
  } catch (err) {
    Sentry.captureException(err);
    console.error('OpenAI API error:', err);
    return jsonError('AI service temporarily unavailable', 503);
  }
}
