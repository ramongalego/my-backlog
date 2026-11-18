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

  const goOn = (param?: [string, string]) => {
    const url = new URL(next);
    if (param) url.searchParams.set(...param);
    return NextResponse.redirect(url);
  };
  const invalidLink = () => goOn(['error', 'invalid_link']);

  // Back from SocialSignIn. A failure goes to the landing page, where signing
  // in is; it isn't a bad link.
  if (searchParams.get('flow') === 'sign-in') {
    const landing = (error?: string) => {
      const url = new URL('/', origin);
      if (error) url.searchParams.set('error', error);
      return NextResponse.redirect(url);
    };
    const refused = searchParams.get('error');
    if (refused) {
      // Their email with that site isn't verified, so Supabase won't take
      // its word for whose account this is.
      if (searchParams.get('error_code') === 'provider_email_needs_verification') {
        return landing('sign_in_unverified');
      }
      // Canceled on the other site's page, which sends no code of Supabase's:
      // nothing went wrong, so nothing is said.
      if (refused === 'access_denied' && !searchParams.get('error_code')) return landing();
      return landing('sign_in_failed');
    }
    if (!code) return landing('sign_in_failed');
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? landing('sign_in_failed') : goOn();
  }

  // Supabase says it couldn't use the link (expired, already used).
  if (searchParams.get('error')) return invalidLink();

  // A link confirming a new email (/api/account/email).
  if (searchParams.get('flow') === 'email-change') {
    // With secure email change, the first of the two links only says so:
    // there's no code until the second is opened.
    if (!code) {
      return searchParams.get('message') ? goOn(['notice', 'email-confirm-other']) : goOn();
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return goOn(['notice', 'email-changed']);
    // The email changed before Supabase sent this code, so say so even when
    // the link opened in another browser and can't sign it in (most of the time).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return goOn(['notice', 'email-changed']);
    return NextResponse.redirect(new URL('/?notice=email-changed-sign-in', origin));
  }

  if (!code) return invalidLink();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return invalidLink();

  return goOn();
}
