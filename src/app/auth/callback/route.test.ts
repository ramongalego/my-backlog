/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';

let exchangeError: Error | null = null;
/** Who is signed in on the device the link is opened on. */
let user: { id: string } | null = null;
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: exchangeError }),
      getUser: async () => ({ data: { user } }),
    },
  }),
}));

const ORIGIN = 'https://mybacklog.test';
const callback = async (query: string) => {
  const res = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`));
  return res.headers.get('location');
};

beforeEach(() => {
  exchangeError = null;
  user = null;
});

it('goes on to the page asked for once the code is exchanged', async () => {
  expect(await callback('?code=abc&next=/home')).toBe(`${ORIGIN}/home`);
  expect(await callback('?code=abc')).toBe(`${ORIGIN}/`);
});

it('sends a missing or rejected code on with an error the page can show', async () => {
  expect(await callback('?next=/home')).toBe(`${ORIGIN}/home?error=invalid_link`);

  exchangeError = new Error('expired');
  expect(await callback('?code=abc&next=/home')).toBe(`${ORIGIN}/home?error=invalid_link`);
});

it("adds the error to a next that has a query of its own, rather than a second '?'", async () => {
  const next = encodeURIComponent('/games?filter=finished');
  expect(await callback(`?next=${next}`)).toBe(
    `${ORIGIN}/games?filter=finished&error=invalid_link`,
  );
});

it.each([
  ['an absolute URL', 'https://evil.test/login'],
  ['a protocol-relative URL', '//evil.test/login'],
  ['a backslash, which browsers read as a slash', '/\\evil.test/login'],
  ['a slash then a backslash', '/\\/evil.test/login'],
])('never redirects off the site: %s', async (_, next) => {
  const location = await callback(`?code=abc&next=${encodeURIComponent(next)}`);
  expect(new URL(location!).origin).toBe(ORIGIN);
});

it('sends a link Supabase refused on with an error, whatever it was for', async () => {
  expect(await callback('?error=access_denied&error_code=otp_expired&next=/home')).toBe(
    `${ORIGIN}/home?error=invalid_link`,
  );
  expect(await callback('?flow=email-change&error=access_denied&next=/profile')).toBe(
    `${ORIGIN}/profile?error=invalid_link`,
  );
});

describe('a link confirming a new email', () => {
  const email = (query: string) => callback(`?flow=email-change&next=/profile${query}`);

  it('says the email is changed once its code is exchanged', async () => {
    expect(await email('&code=abc')).toBe(`${ORIGIN}/profile?notice=email-changed`);
  });

  it('says to open the other link when this was the first of two', async () => {
    const message = encodeURIComponent('Confirmation link accepted. Please proceed');
    expect(await email(`&message=${message}`)).toBe(`${ORIGIN}/profile?notice=email-confirm-other`);
  });

  describe('opened on another device than asked for the change', () => {
    // The email is changed by the time the code is sent; only signing in
    // with it here fails.
    beforeEach(() => {
      exchangeError = new Error('code verifier missing');
    });

    it('still says the email is changed, on the profile, where that device is signed in', async () => {
      user = { id: 'user-1' };
      expect(await email('&code=abc')).toBe(`${ORIGIN}/profile?notice=email-changed`);
    });

    it('says it on the landing page, with how to get back in, where nobody is', async () => {
      expect(await email('&code=abc')).toBe(`${ORIGIN}/?notice=email-changed-sign-in`);
    });
  });

  it('goes to the profile and says nothing for a link with nothing in it', async () => {
    expect(await email('')).toBe(`${ORIGIN}/profile`);
  });
});

describe('back from Google or Discord', () => {
  const back = (query: string) => callback(`?flow=sign-in&next=/home${query}`);

  it('goes on to Home once the code is exchanged', async () => {
    expect(await back('&code=abc')).toBe(`${ORIGIN}/home`);
  });

  it('says nothing when it was canceled on their page', async () => {
    expect(await back('&error=access_denied&error_description=The+user+denied')).toBe(`${ORIGIN}/`);
  });

  it('says to verify the email there when that is why Supabase refused', async () => {
    expect(await back('&error=access_denied&error_code=provider_email_needs_verification')).toBe(
      `${ORIGIN}/?error=sign_in_unverified`,
    );
  });

  it("says it couldn't sign in for any other refusal, a missing code or a rejected one", async () => {
    const failed = `${ORIGIN}/?error=sign_in_failed`;
    expect(await back('&error=server_error&error_code=unexpected_failure')).toBe(failed);
    expect(await back('&error=access_denied&error_code=signup_disabled')).toBe(failed);
    expect(await back('')).toBe(failed);
    exchangeError = new Error('bad code');
    expect(await back('&code=abc')).toBe(failed);
  });
});
