import type { SupabaseClient } from '@supabase/supabase-js';
import { clearLibrary } from '@/lib/steam/library';

it('deletes only the Steam games, leaving the queue to the database cascade', async () => {
  const calls: string[] = [];
  const builder = {
    delete: () => (calls.push('delete'), builder),
    eq: (col: string, val: unknown) => {
      calls.push(`${col}=${val}`);
      return builder;
    },
    then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
  };
  const supabase = {
    from: (table: string) => (calls.push(table), builder),
  } as unknown as SupabaseClient;

  await clearLibrary(supabase, 'u');

  expect(calls).toEqual(['games', 'delete', 'user_id=u', 'source=steam']);
});
