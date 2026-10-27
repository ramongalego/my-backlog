import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshReviewScores } from '@/lib/steam/reviews';
import { getStoreReviews } from '@/lib/steam/store-api';

jest.mock('@/lib/steam/store-api', () => ({ getStoreReviews: jest.fn() }));

it('refreshes Steam games and games added by hand that Steam sells, each by its own row', async () => {
  const rows = [
    {
      id: 1,
      source: 'steam',
      app_id: 10,
      steam_app_id: null,
      steam_review_score: 80,
      steam_review_count: 100,
    },
    {
      id: 2,
      source: 'manual',
      app_id: null,
      steam_app_id: 20,
      steam_review_score: null,
      steam_review_count: null,
    },
  ];
  jest.mocked(getStoreReviews).mockResolvedValue(
    new Map([
      [10, { score: 85, count: 120 }],
      [20, { score: 92, count: 30000 }],
    ]),
  );
  const writes: { table: string; filters: string[] }[] = [];
  const client = () =>
    ({
      from: (table: string) => {
        const write = { table, filters: [] as string[] };
        const builder = {
          select: () => builder,
          or: () => builder,
          order: () => builder,
          range: async () => ({ data: rows, error: null }),
          update: () => (writes.push(write), builder),
          eq: (col: string, val: unknown) => (write.filters.push(`${col}=${val}`), builder),
          then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
        };
        return builder;
      },
    }) as unknown as SupabaseClient;

  expect(await refreshReviewScores(client(), 'u', client())).toBe(2);
  expect(getStoreReviews).toHaveBeenCalledWith([10, 20]);
  expect(writes).toEqual([
    { table: 'games', filters: ['user_id=u', 'id=1'] },
    // Only Steam games are in the shared cache.
    { table: 'game_metadata', filters: ['app_id=10'] },
    { table: 'games', filters: ['user_id=u', 'id=2'] },
  ]);
});
