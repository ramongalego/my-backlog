import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { clearLibrary } from '@/lib/server/steam-library';

/**
 * Steam games come out with their history; games added by hand stay, and so
 * do Steam games moved to a console, which become games added by hand. The
 * games go before the profile's Steam fields, so a failed clear can be retried.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError('Unauthorized', 401);

  const limit = checkRateLimit(`profile-write:${user.id}`, RATE_LIMITS.profileWrite);
  if (!limit.success) return rateLimited(limit);

  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .single();
  if (readError) {
    console.error('Reading the profile failed:', readError);
    return jsonError("Couldn't disconnect Steam. Please try again.", 500);
  }
  // Already disconnected (pressed twice, another tab): done.
  if (!profile?.steam_id) return NextResponse.json({ ok: true });

  const service = tryCreateServiceClient();
  if (!service) return jsonError("Couldn't disconnect Steam. Please try again.", 500);

  try {
    await clearLibrary(supabase, user.id);
  } catch (error) {
    console.error('Clearing the Steam library failed:', error);
    return jsonError("Couldn't disconnect Steam. Please try again.", 500);
  }

  // Profiles are written by the server only.
  const { error } = await service
    .from('profiles')
    .update({
      steam_id: null,
      steam_username: null,
      steam_avatar: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
  if (error) {
    console.error('Unlinking Steam failed:', error);
    return jsonError("Couldn't disconnect Steam. Please try again.", 500);
  }

  return NextResponse.json({ ok: true });
}
