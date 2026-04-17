import { NextRequest, NextResponse } from 'next/server';
import { getCachedRoast } from '@/lib/roast/cache';

// Steam IDs are 17-digit decimal numbers. Validate before hitting the cache so
// arbitrary path segments can't pollute the cache key space.
const STEAM_ID_PATTERN = /^\d{17}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ steamId: string }> },
) {
  const { steamId } = await params;

  if (!STEAM_ID_PATTERN.test(steamId)) {
    return NextResponse.json({ error: 'Invalid Steam ID' }, { status: 400 });
  }

  const cached = getCachedRoast(steamId);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  }

  // Not in cache — client should POST to /api/roast to generate
  return NextResponse.json({ error: 'Roast not found or expired' }, { status: 404 });
}
