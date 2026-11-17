import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOwnedGames, getPlayerSummary } from '@/lib/steam/api';
import { syncSteamIdentity, type SteamIdentity } from '@/lib/server/steam-profile';
import { clearLibrary, syncOwnedGames, type LibrarySyncResult } from '@/lib/server/steam-library';
import { refreshStoreData } from '@/lib/server/steam-store-data';
import { refreshCriticScores } from '@/lib/server/critic-scores';
import { recheckManualHours } from '@/lib/server/manual-hours';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { jsonError, rateLimited } from '@/lib/server/api-response';
import { getSteamApiKey } from '@/lib/server/env';

// A refresh reads the whole library from Steam and, once a day, checks every
// game's reviews and art (50 per call).
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  // Rate limiting per user (not IP) — this is an authenticated endpoint
  const rateLimitResult = await checkSharedRateLimit(
    `steam-refresh:${user.id}`,
    RATE_LIMITS.steamRefresh,
  );
  if (!rateLimitResult.success) {
    return rateLimited(rateLimitResult);
  }

  // Get user's Steam ID from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('steam_id, steam_username, steam_avatar')
    .eq('id', user.id)
    .single();

  // Without Steam there's no library to sync, but the games added by hand
  // still get their review and critic scores refreshed below.
  let result: LibrarySyncResult = { newGames: 0, updatedPlaytime: 0, updatedGames: 0 };
  // Steam shared no library: the profile's game details are private.
  let steamPrivate = false;
  // The Steam name and picture, when they've changed on Steam since saved.
  let steamProfile: SteamIdentity | null = null;
  if (profile?.steam_id) {
    let apiKey: string;
    try {
      apiKey = getSteamApiKey();
    } catch {
      return jsonError('Server config error', 500);
    }

    let steamGames;
    let summary: Awaited<ReturnType<typeof getPlayerSummary>> = null;
    try {
      const [owned, player] = await Promise.all([
        getOwnedGames(profile.steam_id, apiKey),
        // The name and picture are a nicety: Steam failing to give them
        // doesn't fail the refresh, and the saved ones stand.
        getPlayerSummary(profile.steam_id, apiKey).catch((error) => {
          console.error('Steam player summary failed:', error);
          return null;
        }),
      ]);
      steamGames = owned.games;
      steamPrivate = owned.isPrivate;
      summary = player;
    } catch (error) {
      console.error('Steam API error:', error);
      return jsonError('Steam API failed', 502);
    }

    // Steam took seconds to answer, and the account may have been disconnected
    // (or switched to another Steam account) meanwhile: then this library is no
    // longer the player's, and importing it would put it back.
    // A read that fails says nothing either way: the client answers with an
    // error rather than throwing, and taking that for a disconnect would delete
    // the whole library over a timeout. So it's read a second time, and a link
    // that still can't be read is 'unknown', never 'unlinked'.
    const steamLink = async (): Promise<'linked' | 'unlinked' | 'unknown'> => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('steam_id')
          .eq('id', user.id)
          .single();
        if (data && !error) return data.steam_id === profile.steam_id ? 'linked' : 'unlinked';
        console.error('Reading the Steam link failed:', error);
      }
      return 'unknown';
    };
    const linkBefore = await steamLink();
    // Without knowing whose library this is now, none of it is written.
    if (linkBefore === 'unknown') return jsonError('Failed to update library', 500);
    if (linkBefore === 'unlinked') return NextResponse.json({ success: true, ...result });

    try {
      result = await syncOwnedGames(supabase, user.id, steamGames);
    } catch (error) {
      console.error('Library refresh failed:', error);
      return jsonError('Failed to update library', 500);
    }

    // Disconnected while the games were being written: take them out again, as
    // the disconnect meant to. Only when a read showed it: if the link can't be
    // read, the games stay and the refresh carries on as for a linked account.
    if ((await steamLink()) === 'unlinked') {
      await clearLibrary(supabase, user.id).catch((error) =>
        console.error('Clearing a library imported after disconnecting failed:', error),
      );
      return NextResponse.json({ success: true, newGames: 0, updatedPlaytime: 0, updatedGames: 0 });
    }

    steamProfile = await syncSteamIdentity(
      tryCreateServiceClient(),
      user.id,
      profile.steam_id,
      { username: profile.steam_username ?? null, avatar: profile.steam_avatar ?? null },
      summary,
    );
  }

  // Review and critic scores drift slowly, and checking them costs a Steam
  // call per 50 games and an IGDB call per 500, so the app asks for them about
  // once a day ({ reviews: false } skips them). The same Steam calls bring
  // each game's current header art, which Steam swaps for launches and events. A failure here shouldn't fail
  // the refresh, since the library itself is already up to date.
  // Games added by hand have their time to beat looked up again in the same
  // pass: the ones without one, and recent releases, whose time is still
  // moving (see recheckManualHours).
  // No body, or a body that isn't an object (`null`), means the default.
  const sent: unknown = await request.json().catch(() => null);
  const body: { reviews?: unknown } = sent && typeof sent === 'object' ? sent : {};
  let updatedStoreData = 0;
  let updatedCriticScores = 0;
  let updatedHours = 0;
  if (body.reviews !== false) {
    const [store, critics, hours] = await Promise.allSettled([
      refreshStoreData(supabase, user.id, tryCreateServiceClient()),
      refreshCriticScores(supabase, user.id),
      recheckManualHours(supabase, user.id),
    ]);
    if (store.status === 'fulfilled') updatedStoreData = store.value;
    else console.error('Store data refresh failed:', store.reason);
    if (critics.status === 'fulfilled') updatedCriticScores = critics.value;
    else console.error('Critic score refresh failed:', critics.reason);
    if (hours.status === 'fulfilled') updatedHours = hours.value;
    else console.error('Time to beat recheck failed:', hours.reason);
  }

  return NextResponse.json({
    success: true,
    ...result,
    ...(steamPrivate ? { steamPrivate: true } : {}),
    ...(steamProfile ? { steamProfile } : {}),
    updatedStoreData,
    updatedCriticScores,
    updatedHours,
  });
}
