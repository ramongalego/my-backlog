import type { SupabaseClient } from '@supabase/supabase-js';
import { refreshCriticScores } from '@/lib/games/critic-scores';
import { getCriticScoresByIgdbId, getCriticScoresBySteamId } from '@/lib/igdb/api';

jest.mock('@/lib/igdb/api', () => ({
  getCriticScoresBySteamId: jest.fn(),
  getCriticScoresByIgdbId: jest.fn(),
}));

const rows = [
  // A Steam game whose score changed, one that didn't, and one IGDB doesn't rate.
  { id: 1, source: 'steam', app_id: 10, igdb_id: null, critic_score: 80, critic_count: 5 },
  { id: 2, source: 'steam', app_id: 20, igdb_id: null, critic_score: 90, critic_count: 8 },
  { id: 3, source: 'steam', app_id: 30, igdb_id: null, critic_score: 70, critic_count: 4 },
  // A game added by hand, scored for the first time.
  { id: 4, source: 'manual', app_id: null, igdb_id: 400, critic_score: null, critic_count: null },
];

it('updates only changed scores, for Steam games by Steam id and the rest by IGDB id', async () => {
  jest.mocked(getCriticScoresBySteamId).mockResolvedValue(
    new Map([
      [10, { critic_score: 82, critic_count: 6 }],
      [20, { critic_score: 90, critic_count: 8 }],
    ]),
  );
  jest
    .mocked(getCriticScoresByIgdbId)
    .mockResolvedValue(new Map([[400, { critic_score: 94, critic_count: 7 }]]));
  const updates: { values: unknown; id?: unknown }[] = [];
  const supabase = {
    from: () => {
      let pending: { values: unknown; id?: unknown } | null = null;
      const builder = {
        select: () => builder,
        order: () => builder,
        range: async () => ({ data: rows, error: null }),
        update: (values: unknown) => ((pending = { values }), updates.push(pending), builder),
        eq: (col: string, val: unknown) => {
          if (pending && col === 'id') pending.id = val;
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  expect(await refreshCriticScores(supabase, 'u')).toBe(2);
  expect(getCriticScoresBySteamId).toHaveBeenCalledWith([10, 20, 30]);
  expect(getCriticScoresByIgdbId).toHaveBeenCalledWith([400]);
  // Game 3 keeps its score: IGDB has none for it now.
  expect(updates).toEqual([
    { id: 1, values: { critic_score: 82, critic_count: 6 } },
    { id: 4, values: { critic_score: 94, critic_count: 7 } },
  ]);
});
