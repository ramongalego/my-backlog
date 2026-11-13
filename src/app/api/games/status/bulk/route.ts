import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { bulkRestoreSchema, bulkStatusSchema } from '@/lib/validations/games';
import { applyStatusChanges, restoreGames } from '@/lib/server/apply-status';

/**
 * Moves several games to a status at once (Games, Select): all of them are
 * saved, or none. `changes` moves them, and answers with what each game had
 * (`previous`); `restore` takes that back for Undo and writes it as it was.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = checkRateLimit(`game-status-bulk:${user.id}`, RATE_LIMITS.gameStatusBulk);
  if (!limit.success) return rateLimited(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  const undo = bulkRestoreSchema.safeParse(body);
  if (undo.success) {
    const result = await restoreGames(supabase, user.id, undo.data.restore);
    if (!result.ok) return jsonError(result.error, result.status);
    return NextResponse.json({ success: true, count: result.count });
  }

  const parsed = bulkStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
  }

  const result = await applyStatusChanges(supabase, user.id, parsed.data.changes);
  if (!result.ok) return jsonError(result.error, result.status);

  return NextResponse.json({ success: true, count: result.count, previous: result.previous });
}
