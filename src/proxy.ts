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

  // Redirect unauthenticated users away from protected routes
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Redirect authenticated users away from public-only routes (landing page)
  const isPublicOnlyRoute = publicOnlyRoutes.some((route) => pathname === route);
  if (isPublicOnlyRoute && user) {
    // Keep the query string: OAuth and Steam-link failures land on / with ?error=…
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
