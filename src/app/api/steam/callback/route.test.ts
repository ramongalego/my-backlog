/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/steam/callback/route';
import { clearLibrary, syncOwnedGames } from '@/lib/server/steam-library';

const NEW_STEAM_ID = '76561198000000002';
const OLD_STEAM_ID = '76561198000000001';

// What happened, in order: the point of these tests.
const steps: string[] = [];
let linkedSteamId: string | null = OLD_STEAM_ID;
let profileReadError: Error | null = null;
let profileUpdateError: Error | null = null;

jest.mock('@/lib/steam/auth', () => ({
  isSteamAssertion: () => true,
  extractSteamId: () => NEW_STEAM_ID,
  createSteamRelyingParty: () => ({
    verifyAssertion: (
      _url: string,
      done: (error: null, result: { authenticated: boolean; claimedIdentifier: string }) => void,
    ) => done(null, { authenticated: true, claimedIdentifier: 'steam-claimed-id' }),
  }),
}));
jest.mock('@/lib/steam/api', () => ({
  getPlayerSummary: async () => ({ personaname: 'Player', avatarfull: null }),
  getOwnedGames: async () => [{ appid: 10 }],
}));
jest.mock('@/lib/server/env', () => ({ getSteamApiKey: () => 'steam-key' }));
jest.mock('@/lib/server/steam-library', () => ({
  clearLibrary: jest.fn(),
  syncOwnedGames: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: profileReadError ? null : { steam_id: linkedSteamId },
            error: profileReadError,
          }),
        }),
      }),
    }),
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      update: (values: { steam_id: string }) => ({
        eq: async () => {
          if (!profileUpdateError) steps.push(`profile → ${values.steam_id}`);
          return { error: profileUpdateError };
        },
      }),
    }),
  }),
}));

const link = async () => {
  const res = await GET(
    new NextRequest('https://mybacklog.test/api/steam/callback?state=abc', {
      headers: { cookie: 'steam_auth_state=abc' },
    }),
  );
  return res.headers.get('location');
};

beforeEach(() => {
  steps.length = 0;
  linkedSteamId = OLD_STEAM_ID;
  profileReadError = null;
  profileUpdateError = null;
  jest
    .mocked(clearLibrary)
    .mockReset()
    .mockImplementation(async () => {
      steps.push('clear library');
    });
  jest
    .mocked(syncOwnedGames)
    .mockReset()
    .mockImplementation(async () => {
      steps.push('import games');
      return { newGames: 1, updatedPlaytime: 0, updatedGames: 0 };
    });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('replaces the library when a different Steam account is linked: clear, re-point, import', async () => {
  expect(await link()).toBe('https://mybacklog.test/');
  expect(steps).toEqual(['clear library', `profile → ${NEW_STEAM_ID}`, 'import games']);
});

it('keeps the library when the same account is linked again', async () => {
  linkedSteamId = NEW_STEAM_ID;
  await link();
  expect(steps).toEqual([`profile → ${NEW_STEAM_ID}`, 'import games']);
});

it('links a first Steam account without clearing anything', async () => {
  linkedSteamId = null;
  await link();
  expect(steps).toEqual([`profile → ${NEW_STEAM_ID}`, 'import games']);
});

it("leaves the profile on the old account when clearing fails, so the two libraries can't mix", async () => {
  jest.mocked(clearLibrary).mockRejectedValue(new Error('db down'));

  expect(await link()).toBe('https://mybacklog.test/?error=games_insert_failed');
  // Still the old account: linking again clears again, instead of importing
  // the new account's games on top of the old one's.
  expect(steps).toEqual([]);
});

it("stops before touching anything when the current link can't be read", async () => {
  profileReadError = new Error('timeout');

  expect(await link()).toBe('https://mybacklog.test/?error=profile_update_failed');
  expect(steps).toEqual([]);
});

it("doesn't import the new account's games when the profile couldn't be re-pointed", async () => {
  profileUpdateError = new Error('db down');

  expect(await link()).toBe('https://mybacklog.test/?error=profile_update_failed');
  expect(steps).toEqual(['clear library']);
});

it('refuses a callback whose state does not match the cookie', async () => {
  const res = await GET(
    new NextRequest('https://mybacklog.test/api/steam/callback?state=other', {
      headers: { cookie: 'steam_auth_state=abc' },
    }),
  );
  expect(res.headers.get('location')).toBe('https://mybacklog.test/?error=invalid_state');
  expect(steps).toEqual([]);
});
