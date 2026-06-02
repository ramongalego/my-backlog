import { NextResponse } from 'next/server';
import type { RateLimitResult } from '@/lib/rate-limit';

/**
 * Standard error envelope for all API routes: `{ error: string }`.
 * Use this instead of hand-rolling `NextResponse.json({ error }, { status })`
 * so every route returns the same failure shape and clients can rely on it.
 */
export function jsonError(message: string, status: number, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error: message }, headers ? { status, headers } : { status });
}

/**
 * 429 response with the standard rate-limit headers, derived from a
 * RateLimitResult. Keeps the Retry-After / X-RateLimit-* bookkeeping in one
 * place instead of repeating it in every route.
 */
export function rateLimited(result: RateLimitResult): NextResponse {
  return jsonError('Too many requests', 429, {
    'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': '0',
  });
}
