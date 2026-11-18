import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { recordPick, recordPickOutcome } from '@/lib/server/picks';
import { pickOutcomeSchema, randomPickSchema } from '@/lib/validations/suggest';

// What only the browser knows about picks (see lib/server/picks.ts). Neither
// is needed for the pick to work, so one that couldn't be kept still answers 200.

async function signedIn(
  request: NextRequest,
  limitKey: string,
): Promise<{ refused: NextResponse } | { userId: string; body: unknown }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { refused: jsonError('Unauthorized', 401) };

  const rateLimitResult = checkRateLimit(`${limitKey}:${user.id}`, RATE_LIMITS.pickRecord);
  if (!rateLimitResult.success) return { refused: rateLimited(rateLimitResult) };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { refused: jsonError('Invalid JSON', 400) };
  }
  return { userId: user.id, body };
}

/** Answers with the pick's id, null when it couldn't be kept. */
export async function POST(request: NextRequest) {
  const req = await signedIn(request, 'pick-random');
  if ('refused' in req) return req.refused;

  const parsed = randomPickSchema.safeParse(req.body);
  if (!parsed.success) return jsonError('Invalid pick', 400);

  const pickId = await recordPick({ userId: req.userId, ...parsed.data });
  return NextResponse.json({ success: true, pickId });
}

export async function PATCH(request: NextRequest) {
  const req = await signedIn(request, 'pick-outcome');
  if ('refused' in req) return req.refused;

  const parsed = pickOutcomeSchema.safeParse(req.body);
  if (!parsed.success) return jsonError('Invalid pick', 400);

  await recordPickOutcome(req.userId, parsed.data.pickId, parsed.data.outcome);
  return NextResponse.json({ success: true });
}
