/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

jest.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://db.test', SUPABASE_ANON_KEY: 'anon' }));

let claims: { sub: string } | null = null;
// A cookie the session refresh sets while the user is being read, if any.
let refreshed: { name: string; value: string } | null = null;

type CookieHandlers = {
  setAll: (cookies: { name: string; value: string; options: object }[]) => void;
};
jest.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: CookieHandlers }) => ({
    auth: {
      getClaims: async () => {
        if (refreshed) cookies.setAll([{ ...refreshed, options: { path: '/' } }]);
        return { data: claims ? { claims } : null };
      },
    },
  }),
}));

const request = (path: string, init?: { method?: string; headers?: Record<string, string> }) =>
  new NextRequest(`https://mybacklog.test${path}`, init);

beforeEach(() => {
  claims = null;
  refreshed = null;
});

describe('cross-site requests to the API', () => {
  const post = (origin?: string) =>
    proxy(
      request('/api/queue', {
        method: 'POST',
        headers: { host: 'mybacklog.test', ...(origin ? { origin } : {}) },
      }),
    );

  it('refuses a change sent from another site', async () => {
    expect((await post('https://evil.test')).status).toBe(403);
    expect((await post('null')).status).toBe(403);
  });

  it('lets through a change from this site, or with no Origin (not a browser)', async () => {
    expect((await post('https://mybacklog.test')).status).toBe(200);
    expect((await post()).status).toBe(200);
  });
});

describe('profile pages', () => {
  const view = (username: string, ip: string) =>
    proxy(request(`/u/${username}`, { headers: { 'x-vercel-forwarded-for': ip } }));

  it('stops one visitor going through them without end, and nobody else', async () => {
    const { limit } = RATE_LIMITS.profileView;
    for (let i = 0; i < limit; i++) {
      expect((await view(`player${i}`, '203.0.113.7')).status).toBe(200);
    }
    const refused = await view('one-more', '203.0.113.7');
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('Retry-After'))).toBeGreaterThan(0);
    // Another visitor, and every other page, are untouched.
    expect((await view('mistkai', '203.0.113.8')).status).toBe(200);
    expect(
      (await proxy(request('/privacy', { headers: { 'x-vercel-forwarded-for': '203.0.113.7' } })))
        .status,
    ).toBe(200);
  });
});

describe('signed out', () => {
  it('sends a protected page to the landing page', async () => {
    const res = await proxy(request('/home'));
    expect(res.headers.get('location')).toBe('https://mybacklog.test/');
  });

  it('keeps the error a failed sign-up link arrives with, so the page can show it', async () => {
    const res = await proxy(request('/home?error=invalid_link'));
    expect(res.headers.get('location')).toBe('https://mybacklog.test/?error=invalid_link');
  });

  it('shows the landing page', async () => {
    const res = await proxy(request('/'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('signed in', () => {
  beforeEach(() => {
    claims = { sub: 'user-1' };
  });

  it('sends the landing page to Home, keeping the query', async () => {
    const res = await proxy(request('/?error=steam_api_failed'));
    expect(res.headers.get('location')).toBe('https://mybacklog.test/home?error=steam_api_failed');
  });

  it('carries a refreshed session onto the redirect', async () => {
    refreshed = { name: 'sb-access-token', value: 'new-token' };
    const res = await proxy(request('/'));
    expect(res.headers.get('location')).toBe('https://mybacklog.test/home');
    expect(res.cookies.get('sb-access-token')?.value).toBe('new-token');
  });

  it('lets a protected page through', async () => {
    const res = await proxy(request('/games'));
    expect(res.headers.get('location')).toBeNull();
  });
});
