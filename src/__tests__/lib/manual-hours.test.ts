/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { recheckMissingHours } from '@/lib/games/manual-hours';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';

jest.mock('@/lib/hltb/api', () => ({
  ...jest.requireActual('@/lib/hltb/api'),
  getMainStoryHours: jest.fn(),
}));

const now = new Date('2026-11-10T12:00:00Z');

/** The games the query returns, and what was asked of it and written. */
function fakeSupabase(games: { id: number; name: string }[]) {
  const filters: string[] = [];
  const updates: { id: unknown; values: Record<string, unknown> }[] = [];
  const client = {
    from: () => {
      let values: Record<string, unknown> | null = null;
      const builder = {
        select: () => builder,
        update: (v: Record<string, unknown>) => {
          values = v;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          if (values && col === 'id') updates.push({ id: val, values });
          else filters.push(`${col}=${val}`);
          return builder;
        },
        is: (col: string, val: unknown) => {
          filters.push(`${col} is ${val}`);
          return builder;
        },
        or: (val: string) => {
          filters.push(`or ${val}`);
          return builder;
        },
        order: () => builder,
        limit: (n: number) => {
          filters.push(`limit ${n}`);
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve(values ? { error: null } : { data: games, error: null }),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, filters, updates };
}

beforeEach(() => jest.clearAllMocks());

it('looks up hand-added games without a time that were not checked this week', async () => {
  jest.mocked(getMainStoryHours).mockResolvedValueOnce(12).mockResolvedValueOnce(null);
  const { client, filters, updates } = fakeSupabase([
    { id: 1, name: 'Metroid Ravenous' },
    { id: 2, name: 'Persona 4 Revival' },
  ]);

  await expect(recheckMissingHours(client, 'u', now)).resolves.toBe(1);

  expect(filters).toEqual(
    expect.arrayContaining([
      'source=manual',
      'main_story_hours is null',
      'or hltb_checked_at.is.null,hltb_checked_at.lt.2026-11-03T12:00:00.000Z',
      'limit 10',
    ]),
  );
  // Found: the time and when it was checked. Not found: only when, so it waits a week.
  expect(updates).toEqual([
    { id: 1, values: { hltb_checked_at: now.toISOString(), main_story_hours: 12 } },
    { id: 2, values: { hltb_checked_at: now.toISOString() } },
  ]);
});

it('stops, leaving the rest unmarked, while HowLongToBeat is refusing requests', async () => {
  jest.mocked(getMainStoryHours).mockRejectedValue(new HLTBUnavailableError());
  const { client, updates } = fakeSupabase([
    { id: 1, name: 'Metroid Ravenous' },
    { id: 2, name: 'Persona 4 Revival' },
  ]);

  await expect(recheckMissingHours(client, 'u', now)).resolves.toBe(0);
  expect(getMainStoryHours).toHaveBeenCalledTimes(1);
  expect(updates).toEqual([]);
});
