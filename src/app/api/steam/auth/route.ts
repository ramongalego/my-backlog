import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSteamRelyingParty, getSteamAuthUrl } from '@/lib/steam/auth';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { randomBytes } from 'crypto';
import { STEAM_RETURN_COOKIE, steamReturnPath, withSteamOutcome } from '@/lib/steam/return-path';

/**
 * Signed-in players only, and rate limited: building the redirect makes this
 * server contact Steam. `?from=` is where a failure goes back to, kept in a
 * cookie for the way back from Steam.
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

  // CSRF state, which Steam carries back in the return URL.
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
