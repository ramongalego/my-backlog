/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PUT } from '@/app/api/profile/name/route';

let user: { id: string } | null = { id: 'user-1' };
let updateError: { message: string } | null = null;
const updates: { values: Record<string, unknown>; id: unknown }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: unknown) => {
          updates.push({ values, id });
          return { error: updateError };
        },
      }),
    }),
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
  updateError = null;
  updates.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("saves the name, tidied, on the player's own profile", async () => {
  expect(await save({ name: '  Big   <b>Boss</b> ' })).toEqual({
    status: 200,
    body: { name: 'Big Boss' },
  });
  expect(updates).toHaveLength(1);
  expect(updates[0].id).toBe(user!.id);
  expect(updates[0].values.display_name).toBe('Big Boss');
});

it("clears it with null or an empty name, back to the account's", async () => {
  expect((await save({ name: null })).body).toEqual({ name: null });
  expect((await save({ name: '   ' })).body).toEqual({ name: null });
  expect(updates.map((update) => update.values.display_name)).toEqual([null, null]);
});

it('refuses a name that is too long, and anything that is not a name', async () => {
  expect(await save({ name: 'x'.repeat(41) })).toEqual({
    status: 400,
    body: { error: 'Keep it to 40 characters' },
  });
  expect((await save({ name: 42 })).status).toBe(400);
  expect((await save({})).status).toBe(400);
  expect(updates).toEqual([]);
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await save({ name: 'Snake' })).status).toBe(401);
  expect(updates).toEqual([]);
});

it('says so when it could not be saved', async () => {
  updateError = { message: 'boom' };
  expect(await save({ name: 'Snake' })).toEqual({
    status: 500,
    body: { error: "Couldn't save your name. Please try again." },
  });
});
