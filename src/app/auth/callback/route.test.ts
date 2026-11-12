/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/callback/route';

let exchangeError: Error | null = null;
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ error: exchangeError }) },
  }),
}));

const ORIGIN = 'https://mybacklog.test';
const callback = async (query: string) => {
  const res = await GET(new NextRequest(`${ORIGIN}/auth/callback${query}`));
  return res.headers.get('location');
};

beforeEach(() => {
  exchangeError = null;
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
