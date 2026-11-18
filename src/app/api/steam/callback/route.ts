import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { createSteamRelyingParty, extractSteamId, isSteamAssertion } from '@/lib/steam/auth';
import { getOwnedGames, getPlayerSummary } from '@/lib/steam/api';
import { clearLibrary, syncOwnedGames } from '@/lib/server/steam-library';
import { getSteamApiKey } from '@/lib/server/env';
import { constantTimeCompare } from '@/lib/server/constant-time-compare';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { STEAM_RETURN_COOKIE, steamReturnPath, withSteamOutcome } from '@/lib/steam/return-path';

// Linking imports the whole library, with art for each new game.
export const maxDuration = 60;

type Assertion = { authenticated: boolean; claimedIdentifier?: string } | undefined;

function verifyAssertion(returnUrl: string, requestUrl: string): Promise<Assertion> {
  const relyingParty = createSteamRelyingParty(returnUrl);
  return new Promise((resolve) => {
    // The library throws, rather than calling back, on some malformed
    // requests (a parameter given twice): that's a failed sign-in, not a 500.
    try {
      relyingParty.verifyAssertion(requestUrl, (error, result) => {
        resolve(error ? undefined : result);
      });
    } catch {
      resolve(undefined);
    }
  });
}

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  // Success goes to Home to watch the import; anything else goes back to the
  // page Connect Steam was pressed on, with the error for it to show.
  const from = steamReturnPath(request.cookies.get(STEAM_RETURN_COOKIE)?.value, baseUrl);
  const redirect = (error?: string, to = from) => {
    const response = NextResponse.redirect(withSteamOutcome(to, baseUrl, error));
    response.cookies.delete('steam_auth_state');
    response.cookies.delete(STEAM_RETURN_COOKIE);
    return response;
  };

  // Validate CSRF state
  const cookieState = request.cookies.get('steam_auth_state')?.value;
  const urlState = params.get('state');
  if (!cookieState || !urlState || !constantTimeCompare(cookieState, urlState)) {
    return redirect('invalid_state');
  }

  // Reject anything not issued by Steam before the openid library runs
  // discovery on the (attacker-controllable) claimed_id.
  if (!isSteamAssertion(params)) {
    return redirect('steam_auth_failed');
  }

  // Verifying makes this server contact Steam, and any client can pass the
  // state check, so it's for signed-in players only, and rate limited.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error('No authenticated user found');
    return redirect('not_authenticated');
  }

  const limit = await checkSharedRateLimit(`steam-link-verify:${user.id}`, RATE_LIMITS.steamLink);
  if (!limit.success) return redirect('steam_link_limited');

  // OpenID verification fails unless this is the exact returnUrl, state included.
  const assertion = await verifyAssertion(
    `${baseUrl}/api/steam/callback?state=${urlState}`,
    request.url,
  );
  if (!assertion?.authenticated || !assertion.claimedIdentifier) {
    return redirect('steam_auth_failed');
  }

  const steamId = extractSteamId(assertion.claimedIdentifier);
  if (!steamId) {
    console.error('Could not extract Steam ID');
    return redirect('invalid_steam_id');
  }

  let apiKey: string;
  try {
    apiKey = getSteamApiKey();
  } catch {
    console.error('STEAM_API_KEY not configured');
    return redirect('server_config');
  }

  let playerSummary, owned, previous;
  try {
    [playerSummary, owned, previous] = await Promise.all([
      getPlayerSummary(steamId, apiKey),
      getOwnedGames(steamId, apiKey),
      // Resolves with an error rather than throwing, like any Supabase query.
      supabase.from('profiles').select('steam_id').eq('id', user.id).single(),
    ]);
  } catch (err) {
    console.error('Steam API request failed:', err);
    return redirect('steam_api_failed');
  }
  if (previous.error) {
    // Without it there's no telling whether this is a different Steam account,
    // whose library has to replace the one that's there.
    console.error('Profile read failed:', previous.error);
    return redirect('profile_update_failed');
  }
  // Re-linking the same account keeps statuses, ratings and notes; only a
  // different Steam account starts from an empty library.
  const previousSteamId = previous.data?.steam_id;
  const switching = !!previousSteamId && previousSteamId !== steamId;

  // Users can't write their profile themselves: the Steam id is only ever set
  // here, from Steam's verified sign-in, for the signed-in user.
  const service = tryCreateServiceClient();
  if (!service) {
    console.error('SUPABASE_SECRET_KEY not configured; cannot link Steam');
    return redirect('profile_update_failed');
  }

  // Order matters: clear, repoint the profile, import; a refresh mends any
  // failed step. Repointing first would strand the old games if clearing then
  // failed, since the next link would see the same Steam id and never clear.
  if (switching) {
    try {
      await clearLibrary(supabase, user.id);
    } catch (err) {
      console.error('Clearing the previous library failed:', err);
      return redirect('games_insert_failed');
    }
  }

  const { error: profileError } = await service
    .from('profiles')
    .update({
      steam_id: steamId,
      steam_username: playerSummary?.personaname || null,
      steam_avatar: playerSummary?.avatarfull || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) {
    console.error('Profile update failed:', profileError);
    return redirect('profile_update_failed');
  }

  try {
    await syncOwnedGames(supabase, user.id, owned.games);
  } catch (err) {
    console.error('Library import failed:', err);
    return redirect('games_insert_failed');
  }

  // Linked, but game details are private: say so, or connecting looks like it
  // did nothing.
  if (owned.isPrivate) return redirect('steam_private');
  return redirect(undefined, '/home');
}
