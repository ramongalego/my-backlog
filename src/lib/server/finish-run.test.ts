/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanRunStartedAt } from '@/lib/server/finish-run';

jest.mock('server-only', () => ({}));

type Row = Record<string, unknown>;

/** Answers the two reads: the game, and its events newest first. */
function fakeSupabase({
  game,
  events,
  failing,
}: {
  game: Row | null;
  events: Row[];
  failing?: 'games' | 'game_events';
}) {
  const asked: { table: string; filters: [string, unknown][] }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    asked.push({ table, filters });
    const error = failing === table ? { message: 'boom' } : null;
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return chain;
      },
      order: () => chain,
      limit: async () => ({ data: error ? null : events, error }),
      maybeSingle: async () => ({ data: error ? null : game, error }),
    };
    return chain;
  };
  return { supabase: { from } as unknown as SupabaseClient, asked };
}

const event = (id: number, changes: Row, created_at: string) => ({
  id,
  game_id: 7,
  kind: 'status',
  changes,
  created_at,
  updated_at: created_at,
});

const start = event(1, { status: ['backlog', 'playing'] }, '2026-11-06T12:00:00+00:00');
const finish = event(
  2,
  {
    status: ['playing', 'finished'],
    last_played_at: [null, '2026-11-17T00:00:00+00:00'],
    playtime_forever: [0, 900],
  },
  '2026-11-17T20:00:00+00:00',
);
const now = { playtime_forever: 900, last_played_at: '2026-11-17T00:00:00+00:00' };

it("is the start of a clean run, read from the player's own game and its history", async () => {
  const { supabase, asked } = fakeSupabase({ game: now, events: [finish, start] });
  expect(await cleanRunStartedAt(supabase, 'user-1', 7)).toBe('2026-11-06T12:00:00+00:00');
  for (const { filters } of asked) expect(filters).toContainEqual(['user_id', 'user-1']);
});

it('is null where the run had a pause in it', async () => {
  const paused = event(
    2,
    { status: ['playing', 'backlog'], queued: [false, true], last_played_at: [null, 'x'] },
    '2026-11-08T12:00:00+00:00',
  );
  const again = event(3, { status: ['backlog', 'playing'] }, '2026-11-10T12:00:00+00:00');
  const { supabase } = fakeSupabase({
    game: now,
    events: [{ ...finish, id: 4 }, again, paused, start],
  });
  expect(await cleanRunStartedAt(supabase, 'user-1', 7)).toBeNull();
});

it("is null, and doesn't throw, when the game or its history can't be read", async () => {
  for (const failing of ['games', 'game_events'] as const) {
    const { supabase } = fakeSupabase({ game: now, events: [finish, start], failing });
    expect(await cleanRunStartedAt(supabase, 'user-1', 7)).toBeNull();
  }
  expect(
    await cleanRunStartedAt(fakeSupabase({ game: null, events: [] }).supabase, 'u', 7),
  ).toBeNull();
  // No finish in it: nothing to count to.
  const { supabase } = fakeSupabase({ game: now, events: [start] });
  expect(await cleanRunStartedAt(supabase, 'user-1', 7)).toBeNull();
});
