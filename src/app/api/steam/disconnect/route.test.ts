/**
 * @jest-environment node
 */
import { POST } from '@/app/api/steam/disconnect/route';
import { clearLibrary } from '@/lib/server/steam-library';

let user: { id: string } | null = { id: 'user-1' };
let steamId: string | null = '76561198000000000';
let updateError: { message: string } | null = null;
const profileUpdates: Record<string, unknown>[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: { steam_id: steamId }, error: null }),
      };
      return builder;
    },
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          profileUpdates.push(values);
          return { error: updateError };
        },
      }),
    }),
  }),
}));
jest.mock('@/lib/server/steam-library', () => ({ clearLibrary: jest.fn() }));

const disconnect = async () => {
  const res = await POST();
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  user = { id: `user-${Math.random()}` };
  steamId = '76561198000000000';
  updateError = null;
  profileUpdates.length = 0;
  jest.mocked(clearLibrary).mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("takes the Steam games out, then unlinks the account's Steam", async () => {
  expect(await disconnect()).toEqual({ status: 200, body: { ok: true } });
  expect(clearLibrary).toHaveBeenCalledWith(expect.anything(), user!.id);
  expect(profileUpdates).toEqual([
    expect.objectContaining({ steam_id: null, steam_username: null, steam_avatar: null }),
  ]);
});

it('does nothing more when Steam is already disconnected', async () => {
  steamId = null;
  expect((await disconnect()).status).toBe(200);
  expect(clearLibrary).not.toHaveBeenCalled();
  expect(profileUpdates).toEqual([]);
});

it('keeps Steam linked when the games could not be cleared, to try again', async () => {
  jest.mocked(clearLibrary).mockRejectedValue(new Error('boom'));
  expect(await disconnect()).toEqual({
    status: 500,
    body: { error: "Couldn't disconnect Steam. Please try again." },
  });
  expect(profileUpdates).toEqual([]);
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await disconnect()).status).toBe(401);
  expect(clearLibrary).not.toHaveBeenCalled();
});
