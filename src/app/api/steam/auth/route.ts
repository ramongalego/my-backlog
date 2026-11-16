import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSteamRelyingParty, getSteamAuthUrl } from '@/lib/steam/auth';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { randomBytes } from 'crypto';
import { STEAM_RETURN_COOKIE, steamReturnPath, withSteamOutcome } from '@/lib/steam/return-path';

/**
 * Starts linking a Steam account: sends the signed-in player to Steam's sign-in
 * page. Only for signed-in players, and limited: building the redirect makes
 * this server contact Steam, which nobody should be able to trigger without
 * end. (The callback needs a signed-in player anyway, to link the account to.)
 *
 * `?from=` is the page it was started from: a refusal goes back there, and
 * it's kept in a cookie so a failure on the way back from Steam does too.
 * (A library that came through goes to Home, to watch it import.)
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const from = steamReturnPath(request.nextUrl.searchParams.get('from'), baseUrl);
  const back = (error: string) => NextResponse.redirect(withSteamOutcome(from, baseUrl, error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return back('not_authenticated');

  const limit = await checkSharedRateLimit(`steam-link:${user.id}`, RATE_LIMITS.steamLink);
  if (!limit.success) return back('steam_link_limited');

  // Generate CSRF state token and embed it in the return URL so Steam carries it back
  const state = randomBytes(32).toString('hex');
  const returnUrl = `${baseUrl}/api/steam/callback?state=${state}`;

  const relyingParty = createSteamRelyingParty(returnUrl);

  return new Promise<NextResponse>((resolve) => {
    relyingParty.authenticate(getSteamAuthUrl(), false, (error, authUrl) => {
      if (error || !authUrl) {
        // This is a page the browser has gone to, not a request the app
        // made: back to the app, which says so, not a page of JSON.
        resolve(back('steam_auth_failed'));
        return;
      }

      const response = NextResponse.redirect(authUrl);

      // Set state in HTTP-only cookie (5 minute TTL)
      response.cookies.set('steam_auth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300, // 5 minutes
        path: '/',
      });
      // The page to go back to, for as long as the state above lasts.
      response.cookies.set(STEAM_RETURN_COOKIE, from, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300,
        path: '/',
      });

      resolve(response);
    });
  });
}
