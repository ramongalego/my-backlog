/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { aiFeaturesOn } from '@/lib/server/ai-features';

const asked: { table: string; column: string; value: unknown }[] = [];
const database = (answer: { data: unknown; error: unknown }) =>
  ({
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            asked.push({ table, column, value });
            return answer;
          },
        }),
      }),
    }),
  }) as unknown as SupabaseClient;

beforeEach(() => {
  asked.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("is on unless the player's own profile says they turned it off", async () => {
  expect(
    await aiFeaturesOn(database({ data: { ai_disabled: false }, error: null }), 'user-1'),
  ).toBe(true);
  expect(await aiFeaturesOn(database({ data: { ai_disabled: true }, error: null }), 'user-1')).toBe(
    false,
  );
  expect(asked[0]).toEqual({ table: 'profiles', column: 'id', value: 'user-1' });
});

it('is off when it cannot be told: nothing is sent to a model on a guess', async () => {
  const error = { message: 'timeout' };
  expect(await aiFeaturesOn(database({ data: null, error }), 'user-1')).toBe(false);
  expect(console.error).toHaveBeenCalledWith('Reading whether AI features are on failed:', error);

  // No profile to read, or a row that doesn't say.
  expect(await aiFeaturesOn(database({ data: null, error: null }), 'user-1')).toBe(false);
  expect(await aiFeaturesOn(database({ data: {}, error: null }), 'user-1')).toBe(false);
});
