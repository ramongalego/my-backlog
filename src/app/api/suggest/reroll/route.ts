import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsonError } from '@/lib/api/response';
import { queueAddRequestSchema } from '@/lib/validations/common';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = queueAddRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid appId', 400);
  }
  const { appId } = parsed.data;

  // Counts the reroll and stamps it, so the penalty fades (see record_reroll).
  const { error } = await supabase.rpc('record_reroll', { p_app_id: appId });

  if (error) {
    console.error('Failed to record reroll:', error);
    // Non-critical error, don't fail the request
  }

  return NextResponse.json({ success: true });
}
