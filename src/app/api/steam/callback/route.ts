import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryCreateServiceClient } from '@/lib/supabase/service';
import { createSteamRelyingParty, extractSteamId, isSteamAssertion } from '@/lib/steam/auth';
import { getOwnedGames, getPlayerSummary } from '@/lib/steam/api';
import { clearLibrary, syncOwnedGames } from '@/lib/steam/library';
import { getSteamApiKey } from '@/lib/env.server';
import { constantTimeCompare } from '@/lib/crypto/compare';

type Assertion = { authenticated: boolean; claimedIdentifier?: string } | undefined;

function verifyAssertion(returnUrl: string, requestUrl: string): Promise<Assertion> {
  const relyingParty = createSteamRelyingParty(returnUrl);
  return new Promise((resolve) => {
    relyingParty.verifyAssertion(requestUrl, (error, result) => {
      resolve(error ? undefined : result);
    });
  });
}

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  // Every exit clears the one-time state cookie.
  const redirect = (path: string) => {
    const response = NextResponse.redirect(`${baseUrl}${path}`);
    response.cookies.delete('steam_auth_state');
    return response;
  };

  // Validate CSRF state
  const cookieState = request.cookies.get('steam_auth_state')?.value;
  const urlState = params.get('state');
  if (!cookieState || !urlState || !constantTimeCompare(cookieState, urlState)) {
    return redirect('/?error=invalid_state');
  }

  // Reject anything not issued by Steam before the openid library runs
  // discovery on the (attacker-controllable) claimed_id.
  if (!isSteamAssertion(params)) {
    return redirect('/?error=steam_auth_failed');
  }

  // Reconstruct the exact returnUrl used during auth (with state) so OpenID verification passes
  const assertion = await verifyAssertion(
    `${baseUrl}/api/steam/callback?state=${urlState}`,
    request.url,
  );
  if (!assertion?.authenticated || !assertion.claimedIdentifier) {
    return redirect('/?error=steam_auth_failed');
  }

  const steamId = extractSteamId(assertion.claimedIdentifier);
  if (!steamId) {
    console.error('Could not extract Steam ID');
    return redirect('/?error=invalid_steam_id');
  }

  let apiKey: string;
  try {
    apiKey = getSteamApiKey();
  } catch {
    console.error('STEAM_API_KEY not configured');
    return redirect('/?error=server_config');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error('No authenticated user found');
    return redirect('/?error=not_authenticated');
  }

  let playerSummary, games;
  try {
    [playerSummary, games] = await Promise.all([
      getPlayerSummary(steamId, apiKey),
      getOwnedGames(steamId, apiKey),
    ]);
  } catch (err) {
    console.error('Steam API request failed:', err);
    return redirect('/?error=steam_api_failed');
  }

  const { data: previousProfile } = await supabase
    .from('profiles')
    .select('steam_id')
    .eq('id', user.id)
    .single();

  // Users can't write their profile themselves: the Steam id is only ever set
  // here, from Steam's verified sign-in, for the signed-in user.
  const service = tryCreateServiceClient();
  if (!service) {
    console.error('SUPABASE_SECRET_KEY not configured; cannot link Steam');
    return redirect('/?error=profile_update_failed');
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
    return redirect('/?error=profile_update_failed');
  }

  try {
    // Re-linking the same account keeps statuses, ratings and notes; only a
    // different Steam account starts from an empty library.
    const previousSteamId = previousProfile?.steam_id;
    if (previousSteamId && previousSteamId !== steamId) {
      await clearLibrary(supabase, user.id);
    }
    await syncOwnedGames(supabase, user.id, games);
  } catch (err) {
    console.error('Library import failed:', err);
    return redirect('/?error=games_insert_failed');
  }

  return redirect('/');
}
