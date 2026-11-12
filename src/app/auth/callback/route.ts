import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';

  // Only ever a path on this site. Resolved as a URL and checked, since
  // "//host" and "/\host" both parse as another site.
  const target = new URL(nextParam.startsWith('/') ? nextParam : '/', origin);
  const next = target.origin === origin ? target : new URL('/', origin);

  // The page it lands on shows the error. `next` may carry a query of its own.
  const invalidLink = () => {
    const url = new URL(next);
    url.searchParams.set('error', 'invalid_link');
    return NextResponse.redirect(url);
  };

  if (!code) return invalidLink();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return invalidLink();

  return NextResponse.redirect(next);
}
