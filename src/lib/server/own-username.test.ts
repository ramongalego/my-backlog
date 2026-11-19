/**
 * @jest-environment node
 */
import { ownUsername } from '@/lib/server/own-username';

let claims: { sub: string } | null = { sub: 'user-1' };
let row: { username: string } | null = { username: 'mistkai' };
const asked: { table: string; column: string; value: unknown }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            asked.push({ table, column, value });
            return { data: row };
          },
        }),
      }),
    }),
  }),
}));

beforeEach(() => {
  claims = { sub: 'user-1' };
  row = { username: 'mistkai' };
  asked.length = 0;
});

it("is the username on the signed-in player's own profile", async () => {
  expect(await ownUsername()).toBe('mistkai');
  expect(asked).toEqual([{ table: 'profiles', column: 'id', value: 'user-1' }]);
});

it('is none for a signed-out visitor, without asking the database', async () => {
  claims = null;
  expect(await ownUsername()).toBeNull();
  expect(asked).toEqual([]);
});

it('is none when the profile cannot be read', async () => {
  row = null;
  expect(await ownUsername()).toBeNull();
});
