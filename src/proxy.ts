import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { isProtectedPath } from '@/lib/routes';
import { checkRateLimit, getClientIp, ipRateLimitKey, RATE_LIMITS } from '@/lib/server/rate-limit';

const publicOnlyRoutes = ['/'];
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function proxy(request: NextRequest) {
  // CSRF: browsers always send Origin on these methods, so another site can't
  // forge a match. A request without one (curl) carries no session cookies.
  if (request.nextUrl.pathname.startsWith('/api/') && MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const host = request.headers.get('host');
        if (originHost !== host) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  // API routes authenticate themselves (and can refresh the session cookie),
  // so skip the auth round trip here for them.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // A profile is read for anyone who has its address, with the server's own
  // key: one visitor can't go through addresses, or the same one, without end.
  // Counted in memory (no round trip on every page), so per server instance.
  if (request.nextUrl.pathname.startsWith('/u/')) {
    const limit = checkRateLimit(
      `profile-view:${ipRateLimitKey(getClientIp(request))}`,
      RATE_LIMITS.profileView,
    );
    if (!limit.success) {
      const seconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return new NextResponse('Too many requests. Try again in a minute.', {
        status: 429,
        headers: { 'Retry-After': String(seconds) },
      });
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // With asymmetric signing keys, getClaims verifies the JWT locally instead of
  // calling Supabase Auth on every navigation.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;

  // Keeps the query string (an ?error=… for the page to show) and the cookies
  // getClaims just refreshed, or the next request reuses a spent refresh token.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  if (isProtectedPath(pathname) && !user) return redirectTo('/');

  const isPublicOnlyRoute = publicOnlyRoutes.some((route) => pathname === route);
  if (isPublicOnlyRoute && user) return redirectTo('/home');

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Not Sentry's tunnel (next.config.ts): reports don't need the sign-in check.
    '/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Every API path, including one that happens to end like an image file:
    // the pattern above would let it past the cross-site check.
    '/api/:path*',
  ],
};
