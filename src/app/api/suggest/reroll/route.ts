import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { appId } = body as { appId?: number };

  if (!appId || typeof appId !== 'number' || !Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid appId' }, { status: 400 });
  }

  // Get current reroll count
  const { data: game } = await supabase
    .from('games')
    .select('reroll_count')
    .eq('user_id', user.id)
    .eq('app_id', appId)
    .maybeSingle();

  // Increment the reroll count
  const currentCount = game?.reroll_count ?? 0;
  const { error } = await supabase
    .from('games')
    .update({ reroll_count: currentCount + 1 })
    .eq('user_id', user.id)
    .eq('app_id', appId);

  if (error) {
    console.error('Failed to increment reroll count:', error);
    // Non-critical error, don't fail the request
  }

  return NextResponse.json({ success: true });
}
