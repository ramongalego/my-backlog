/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/steam/auth/route';

let signedIn = true;
let limited = false;
let steamContacted = 0;
let steamFails = false;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'user-1' } : null } }) },
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({ success: !limited }),
}));
jest.mock('@/lib/steam/auth', () => ({
  getSteamAuthUrl: () => 'https://steamcommunity.com/openid',
  createSteamRelyingParty: () => ({
    authenticate: (
      _url: string,
      _immediate: boolean,
      done: (e: Error | null, url: string | null) => void,
    ) => {
      steamContacted++;
      if (steamFails) done(new Error('Steam is down'), null);
      else done(null, 'https://steamcommunity.com/openid/login?x=1');
    },
  }),
}));

const start = () => GET(new NextRequest('https://mybacklog.test/api/steam/auth'));

beforeEach(() => {
  signedIn = true;
  limited = false;
  steamContacted = 0;
  steamFails = false;
});

it("goes back to the app, which says so, when Steam's page can't be reached", async () => {
  steamFails = true;
  const res = await start();
  // Not a page of JSON: the browser itself came here.
  expect(res.headers.get('location')).toBe('https://mybacklog.test/?error=steam_auth_failed');
  expect(res.cookies.get('steam_auth_state')).toBeUndefined();
});

it('sends a signed-in player to Steam, with a one-time state cookie', async () => {
  const res = await start();
  expect(res.headers.get('location')).toBe('https://steamcommunity.com/openid/login?x=1');
  const state = res.cookies.get('steam_auth_state');
  expect(state?.value).toMatch(/^[0-9a-f]{64}$/);
  expect(state?.httpOnly).toBe(true);
});

it("doesn't contact Steam for a visitor who is not signed in", async () => {
  signedIn = false;
  const res = await start();
  expect(res.headers.get('location')).toBe('https://mybacklog.test/?error=not_authenticated');
  expect(steamContacted).toBe(0);
});

it("doesn't contact Steam for a player past the limit", async () => {
  limited = true;
  const res = await start();
  expect(res.headers.get('location')).toBe('https://mybacklog.test/?error=steam_link_limited');
  expect(steamContacted).toBe(0);
});
