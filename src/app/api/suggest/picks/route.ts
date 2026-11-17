import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { recordPick, recordPickOutcome } from '@/lib/server/picks';
import { pickOutcomeSchema, randomPickSchema } from '@/lib/validations/suggest';

// The picks kept for later study (game_picks, see lib/server/picks.ts). A pick
// from the questions is kept by /api/suggest, which makes it. These two keep
// what only the browser knows: a random pick, which it makes itself, and what
// the player then did with any pick. Neither is needed for the pick to work,
// so a pick that couldn't be kept still answers 200.

/** The signed-in player and the request's body, or the response that refuses it. */
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

/** Keeps a random pick. Answers with its id (null when it couldn't be kept). */
export async function POST(request: NextRequest) {
  const req = await signedIn(request, 'pick-random');
  if ('refused' in req) return req.refused;

  const parsed = randomPickSchema.safeParse(req.body);
  if (!parsed.success) return jsonError('Invalid pick', 400);

  const pickId = await recordPick({ userId: req.userId, ...parsed.data });
  return NextResponse.json({ success: true, pickId });
}

/** Keeps what the player did with a pick: started it, queued it, rolled again, or never saw it. */
export async function PATCH(request: NextRequest) {
  const req = await signedIn(request, 'pick-outcome');
  if ('refused' in req) return req.refused;

  const parsed = pickOutcomeSchema.safeParse(req.body);
  if (!parsed.success) return jsonError('Invalid pick', 400);

  await recordPickOutcome(req.userId, parsed.data.pickId, parsed.data.outcome);
  return NextResponse.json({ success: true });
}
