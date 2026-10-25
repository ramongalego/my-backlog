import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { jsonError, rateLimited } from '@/lib/api/response';
import { gameStatusSchema } from '@/lib/validations/games';
import { applyStatusChange, promoteNextFromQueue } from '@/lib/games/apply-status';
import { fetchCompletionCounts } from '@/lib/games/completion';

const completeSchema = gameStatusSchema.extend({
  status: gameStatusSchema.shape.status.extract(['finished', 'dropped']),
});

/**
 * Finishes or drops the playing game in one request: saves it, then counts
 * the library for the summary while starting the next game in the queue. The
 * browser used to do these one after another, about five round trips before
 * the summary could show.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  const rateLimitResult = checkRateLimit(`game-status:${user.id}`, RATE_LIMITS.gameStatus);
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  }

  const result = await applyStatusChange(supabase, user.id, parsed.data);
  if (!result.ok) return jsonError(result.error, result.status);

  // The finish/drop is saved; the follow-ups are best-effort, so a failed
  // promote doesn't report the whole action as failed.
  const [counts, promoted] = await Promise.allSettled([
    fetchCompletionCounts(supabase, user.id),
    promoteNextFromQueue(supabase, user.id),
  ]);
  if (counts.status === 'rejected') console.error(counts.reason);
  if (promoted.status === 'rejected') console.error(promoted.reason);

  return NextResponse.json({
    counts: counts.status === 'fulfilled' ? counts.value : { gamesFinished: 0, totalGames: 0 },
    promoted: promoted.status === 'fulfilled' ? promoted.value : null,
    promoteFailed: promoted.status === 'rejected',
  });
}
