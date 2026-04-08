import { NextRequest, NextResponse } from 'next/server';
import { getCachedRoast } from '@/lib/roast/cache';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ steamId: string }> },
) {
  const { steamId } = await params;

  const cached = getCachedRoast(steamId);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  }

  // Not in cache — client should POST to /api/roast to generate
  return NextResponse.json({ error: 'Roast not found or expired' }, { status: 404 });
}
