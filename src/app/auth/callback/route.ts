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

  /** Goes on to `next` with one more query param, which the page it lands on reads. */
  const goOn = (param?: [string, string]) => {
    const url = new URL(next);
    if (param) url.searchParams.set(...param);
    return NextResponse.redirect(url);
  };
  const invalidLink = () => goOn(['error', 'invalid_link']);

  // Supabase says it couldn't use the link (expired, already used).
  if (searchParams.get('error')) return invalidLink();

  // A link confirming a new email, from the profile (/api/account/email).
  if (searchParams.get('flow') === 'email-change') {
    // With secure email change, the first of the two links only says so:
    // there's no code until the second is opened.
    if (!code) {
      return searchParams.get('message') ? goOn(['notice', 'email-confirm-other']) : goOn();
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Supabase has changed the email by the time it sends the code; what
    // can fail is only signing in here, as when the link is opened on another
    // device. The profile shows the email as it stands, so it's left to say.
    return error ? goOn() : goOn(['notice', 'email-changed']);
  }

  if (!code) return invalidLink();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return invalidLink();

  return goOn();
}
