/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PUT } from '@/app/api/profile/name/route';

let user: { id: string } | null = { id: 'user-1' };
let answer: unknown = 'ok';
let rpcError: { message: string } | null = null;
const saves: { name: string; args: { p_user: unknown; p_name: unknown } }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    rpc: async (name: string, args: { p_user: unknown; p_name: unknown }) => {
      saves.push({ name, args });
      return { data: rpcError ? null : answer, error: rpcError };
    },
  }),
}));

const save = async (body: unknown) => {
  const res = await PUT(
    new Request('http://localhost/api/profile/name', {
      method: 'PUT',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  user = { id: `user-${Math.random()}` };
  answer = 'ok';
  rpcError = null;
  saves.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("saves the name, tidied, on the player's own profile", async () => {
  expect(await save({ name: '  Big   <b>Boss</b> ' })).toEqual({
    status: 200,
    body: { name: 'Big Boss' },
  });
  expect(saves).toEqual([
    { name: 'set_display_name', args: { p_user: user!.id, p_name: 'Big Boss' } },
  ]);
});

it("clears it with null or an empty name, back to the account's", async () => {
  expect((await save({ name: null })).body).toEqual({ name: null });
  expect((await save({ name: '   ' })).body).toEqual({ name: null });
  expect(saves.map((one) => one.args.p_name)).toEqual([null, null]);
});

it('refuses a name that is too long, and anything that is not a name', async () => {
  expect(await save({ name: 'x'.repeat(41) })).toEqual({
    status: 400,
    body: { error: 'Keep it to 40 characters' },
  });
  expect((await save({ name: 42 })).status).toBe(400);
  expect((await save({})).status).toBe(400);
  expect(saves).toEqual([]);
});

it('says a name the database refuses to show to others is not available', async () => {
  answer = 'refused';
  expect(await save({ name: 'MyBacklog Support' })).toEqual({
    status: 400,
    body: { error: "That name isn't available" },
  });
  // Nothing went wrong: it isn't reported.
  expect(console.error).not.toHaveBeenCalled();
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await save({ name: 'Snake' })).status).toBe(401);
  expect(saves).toEqual([]);
});

it('says so, and logs it, when it could not be saved', async () => {
  rpcError = { message: 'boom' };
  expect(await save({ name: 'Snake' })).toEqual({
    status: 500,
    body: { error: "Couldn't save your name. Please try again." },
  });
  rpcError = null;
  answer = 'no_profile';
  expect((await save({ name: 'Snake' })).status).toBe(500);
  expect(console.error).toHaveBeenCalledTimes(2);
});

it('refuses a name that draws nothing: zero-width and direction marks are taken out first', async () => {
  // Only invisible characters: the same as leaving it empty.
  expect((await save({ name: '​‮ㅤ' })).body).toEqual({ name: null });
  expect((await save({ name: 'Big​ Boss‮' })).body).toEqual({ name: 'Big Boss' });
});

it('keeps accents and emoji, and cuts marks stacked past what any writing needs', async () => {
  expect((await save({ name: 'Ramón 🎮' })).body).toEqual({ name: 'Ramón 🎮' });
  // An accent typed as a letter and a mark is one letter, saved as one.
  expect((await save({ name: 'Ramón' })).body).toEqual({ name: 'Ramón' });
  // "Glitch text": a dozen marks on one letter spill over the lines around it.
  const glitched = `x${'̐͑͗͛'.repeat(3)}algo`;
  const { body } = await save({ name: glitched });
  expect(body.name).toBe('x̐͑͗͛algo');
  expect(saves.at(-1)!.args.p_name).toBe(body.name);
});
