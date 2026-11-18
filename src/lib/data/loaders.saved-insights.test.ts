/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadSavedInsights } from '@/lib/data/loaders';

let rows: unknown[] = [];
let failure: { message: string } | null = null;
const filters: [string, unknown][] = [];

const supabase = {
  from: (table: string) => {
    expect(table).toBe('player_insights');
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => (filters.push([column, value]), builder),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: failure ? null : rows, error: failure }),
    };
    return builder;
  },
} as unknown as SupabaseClient;

beforeEach(() => {
  rows = [];
  failure = null;
  filters.length = 0;
});

it("reads the player's own profile and roast, each under its tone", async () => {
  rows = [
    {
      tone: 'roast',
      headline: 'Roasted',
      paragraphs: ['Ouch.'],
      signature: 'v4:1',
      generated_at: '2026-11-07T12:00:00Z',
    },
  ];
  expect(await loadSavedInsights(supabase, 'user-1')).toEqual({
    profile: null,
    roast: {
      headline: 'Roasted',
      paragraphs: ['Ouch.'],
      signature: 'v4:1',
      generatedAt: '2026-11-07T12:00:00Z',
    },
  });
  expect(filters).toEqual([['user_id', 'user-1']]);
});

it('is neither when nothing has been written', async () => {
  expect(await loadSavedInsights(supabase, 'user-1')).toEqual({ profile: null, roast: null });
});

it('throws when the read fails, so the query shows it', async () => {
  failure = { message: 'down' };
  await expect(loadSavedInsights(supabase, 'user-1')).rejects.toEqual({ message: 'down' });
});
