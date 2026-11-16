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
    if (!error) return goOn(['notice', 'email-changed']);
    // Supabase had changed the email before it sent this code, so it's changed
    // whether or not this browser could be signed in with it. It can't be
    // where the link is opened in another one than asked for the change (a
    // phone's mail app, for a change made on a laptop), which is most of the
    // time: said there too, or the link looks like it did nothing.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return goOn(['notice', 'email-changed']);
    // Nobody signed in here: the landing page, with how to get back in.
    return NextResponse.redirect(new URL('/?notice=email-changed-sign-in', origin));
  }

  if (!code) return invalidLink();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return invalidLink();

  return goOn();
}
