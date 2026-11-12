import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

const protectedRoutes = ['/home', '/games', '/diary', '/stats', '/playing-queue'];
const publicOnlyRoutes = ['/'];
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function proxy(request: NextRequest) {
  // CSRF defense: reject cross-origin mutating API requests. Browsers reliably
  // send Origin on POST/PATCH/DELETE, so an attacker site can't forge a match.
  // Missing Origin (server-to-server, curl) is allowed — those clients don't
  // carry session cookies anyway.
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

  // Refreshes the auth token if needed. getClaims verifies the JWT locally when
  // the project uses asymmetric signing keys, avoiding a call to Supabase Auth
  // on every navigation.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = request.nextUrl;

  // A redirect to another page of the app, keeping the query string (failed
  // sign-up links and Steam-link failures arrive with ?error=…, which the
  // page they land on shows) and any session cookies getClaims just refreshed:
  // without those, the next request would refresh again with a refresh token
  // that has already been used.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  // Redirect unauthenticated users away from protected routes
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  if (isProtectedRoute && !user) return redirectTo('/');

  // Redirect authenticated users away from public-only routes (landing page)
  const isPublicOnlyRoute = publicOnlyRoutes.some((route) => pathname === route);
  if (isPublicOnlyRoute && user) return redirectTo('/home');

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
