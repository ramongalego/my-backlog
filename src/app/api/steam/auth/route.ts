import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSteamRelyingParty, getSteamAuthUrl } from '@/lib/steam/auth';
import { checkSharedRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { randomBytes } from 'crypto';

/**
 * Starts linking a Steam account: sends the signed-in player to Steam's sign-in
 * page. Only for signed-in players, and limited: building the redirect makes
 * this server contact Steam, which nobody should be able to trigger without
 * end. (The callback needs a signed-in player anyway, to link the account to.)
 */
export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${baseUrl}/?error=not_authenticated`);

  const limit = await checkSharedRateLimit(`steam-link:${user.id}`, RATE_LIMITS.steamLink);
  if (!limit.success) return NextResponse.redirect(`${baseUrl}/?error=steam_link_limited`);

  // Generate CSRF state token and embed it in the return URL so Steam carries it back
  const state = randomBytes(32).toString('hex');
  const returnUrl = `${baseUrl}/api/steam/callback?state=${state}`;

  const relyingParty = createSteamRelyingParty(returnUrl);

  return new Promise<NextResponse>((resolve) => {
    relyingParty.authenticate(getSteamAuthUrl(), false, (error, authUrl) => {
      if (error || !authUrl) {
        resolve(NextResponse.json({ error: 'Failed to create Steam auth URL' }, { status: 500 }));
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

      resolve(response);
    });
  });
}
