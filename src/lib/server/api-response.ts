import 'server-only';
import { NextResponse } from 'next/server';
import type { RateLimitResult } from '@/lib/server/rate-limit';

/** Every route fails in this shape, so clients can rely on it. */
export function jsonError(message: string, status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error: message }, headers ? { status, headers } : { status });
}

export function rateLimited(result: RateLimitResult): NextResponse {
  return jsonError('Too many requests', 429, {
    'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': '0',
  });
}
