import type { SupabaseClient } from '@supabase/supabase-js';
import { clearLibrary } from '@/lib/steam/library';

it('keeps games moved to a console, then deletes the Steam games (the queue cascades)', async () => {
  const calls: string[] = [];
  const builder = {
    update: (values: Record<string, unknown>) => (
      calls.push(`update ${JSON.stringify(values)}`),
      builder
    ),
    delete: () => (calls.push('delete'), builder),
    eq: (col: string, val: unknown) => {
      calls.push(`${col}=${val}`);
      return builder;
    },
    not: (col: string, op: string, val: unknown) => (
      calls.push(`${col} not ${op} ${val}`),
      builder
    ),
    neq: (col: string, val: unknown) => (calls.push(`${col}!=${val}`), builder),
    then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
  };
  const supabase = {
    from: (table: string) => (calls.push(table), builder),
  } as unknown as SupabaseClient;

  await clearLibrary(supabase, 'u');

  expect(calls).toEqual([
    // A Steam game played on Switch becomes a console game, with its history.
    'games',
    'update {"source":"manual","app_id":null}',
    'user_id=u',
    'source=steam',
    'platform not is null',
    'platform!=PC',
    // Everything still from Steam goes.
    'games',
    'delete',
    'user_id=u',
    'source=steam',
  ]);
});
