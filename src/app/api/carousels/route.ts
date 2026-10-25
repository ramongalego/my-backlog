import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jsonError } from '@/lib/api/response';
import { loadCarouselPools } from '@/lib/data/loaders';

/**
 * The Home carousels for the signed-in user. Building them reads the whole
 * backlog, so it happens here and the browser receives only the finished rows.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const pools = await loadCarouselPools(supabase, user.id);
    return NextResponse.json(pools, { headers: { 'Cache-Control': 'private, no-cache' } });
  } catch (error) {
    console.error(error);
    return jsonError('Failed to load carousels', 500);
  }
}
