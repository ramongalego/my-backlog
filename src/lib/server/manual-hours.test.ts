/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { recheckManualHours } from '@/lib/server/manual-hours';
import { getMainStoryHours, HLTBUnavailableError } from '@/lib/hltb/api';

jest.mock('@/lib/hltb/api', () => ({
  ...jest.requireActual('@/lib/hltb/api'),
  getMainStoryHours: jest.fn(),
}));

const now = new Date('2026-11-10T12:00:00Z');

interface Row {
  id: number;
  name: string;
  release_date?: string | null;
  main_story_hours?: number | null;
  hltb_checked_at?: string | null;
}

/** The games the query returns, and what was asked of it and written. */
function fakeSupabase(games: Row[]) {
  const filters: string[] = [];
  const updates: { id: unknown; values: Record<string, unknown> }[] = [];
  const rows = games.map((game) => ({
    release_date: null,
    main_story_hours: null,
    hltb_checked_at: null,
    ...game,
  }));
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
          // What the query asked for, or which game an update is for.
          if (!values) filters.push(`${col}=${val}`);
          else if (col === 'id') updates.push({ id: val, values });
          return builder;
        },
        or: (val: string) => {
          filters.push(`or ${val}`);
          return builder;
        },
        order: () => builder,
        then: (resolve: (v: unknown) => unknown) =>
          resolve(values ? { error: null } : { data: rows, error: null }),
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
    { id: 1, name: 'Metroid Ravenous', release_date: 'Dec 4, 2026' },
    { id: 2, name: 'Persona 4 Revival' },
  ]);

  await expect(recheckManualHours(client, 'u', now)).resolves.toBe(1);

  // With the release year, which tells a remake from its original.
  expect(jest.mocked(getMainStoryHours).mock.calls).toEqual([
    ['Metroid Ravenous', 2026],
    ['Persona 4 Revival', null],
  ]);

  // Only the user's hand-added games, and none checked in the last week.
  expect(filters).toEqual([
    'user_id=u',
    'source=manual',
    'or hltb_checked_at.is.null,hltb_checked_at.lt.2026-11-03T12:00:00.000Z',
  ]);
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

  await expect(recheckManualHours(client, 'u', now)).resolves.toBe(0);
  expect(getMainStoryHours).toHaveBeenCalledTimes(1);
  expect(updates).toEqual([]);
});

describe('a recent release that already has a time', () => {
  // Out eight weeks: its time is still moving as more people finish it.
  const fortunesWeave = {
    id: 1,
    name: "Fire Emblem: Fortune's Weave",
    release_date: 'Sep 17, 2026',
    main_story_hours: 78.5,
  };

  it('gets the time HowLongToBeat has now', async () => {
    jest.mocked(getMainStoryHours).mockResolvedValue(95.1);
    const { client, updates } = fakeSupabase([fortunesWeave]);

    await expect(recheckManualHours(client, 'u', now)).resolves.toBe(1);

    expect(getMainStoryHours).toHaveBeenCalledWith("Fire Emblem: Fortune's Weave", 2026);
    expect(updates).toEqual([
      { id: 1, values: { hltb_checked_at: now.toISOString(), main_story_hours: 95.1 } },
    ]);
  });

  it("keeps the time it has when HowLongToBeat doesn't answer with one", async () => {
    jest.mocked(getMainStoryHours).mockResolvedValue(null);
    const { client, updates } = fakeSupabase([fortunesWeave]);

    await expect(recheckManualHours(client, 'u', now)).resolves.toBe(0);
    // Marked as checked, the time untouched.
    expect(updates).toEqual([{ id: 1, values: { hltb_checked_at: now.toISOString() } }]);
  });

  it("isn't counted as changed when the time is the same", async () => {
    jest.mocked(getMainStoryHours).mockResolvedValue(78.5);
    const { client, updates } = fakeSupabase([fortunesWeave]);

    await expect(recheckManualHours(client, 'u', now)).resolves.toBe(0);
    expect(updates).toHaveLength(1);
  });
});

it('leaves a settled game alone: out over a year, or with no known date', async () => {
  const { client, updates } = fakeSupabase([
    { id: 1, name: 'Persona 5 Royal', release_date: 'Mar 31, 2020', main_story_hours: 101.3 },
    { id: 2, name: 'Some Import', release_date: null, main_story_hours: 20 },
    { id: 3, name: 'Next Year', release_date: 'Mar 1, 2027', main_story_hours: 30 },
  ]);

  await expect(recheckManualHours(client, 'u', now)).resolves.toBe(0);
  expect(getMainStoryHours).not.toHaveBeenCalled();
  expect(updates).toEqual([]);
});

it('checks ten games a visit, so a big library never uses up the allowance', async () => {
  jest.mocked(getMainStoryHours).mockResolvedValue(10);
  // Twelve due, plus settled games in between that don't take a place.
  const games = Array.from({ length: 24 }, (_, i) =>
    i % 2
      ? { id: i, name: `Old ${i}`, release_date: 'Jan 1, 2015', main_story_hours: 9 }
      : { id: i, name: `New ${i}` },
  );
  const { client, updates } = fakeSupabase(games);

  await expect(recheckManualHours(client, 'u', now)).resolves.toBe(10);
  expect(getMainStoryHours).toHaveBeenCalledTimes(10);
  // In the order the query gave them (oldest check first).
  expect(updates.map((u) => u.id)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
});
