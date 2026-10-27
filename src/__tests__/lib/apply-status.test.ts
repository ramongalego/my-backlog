import type { SupabaseClient } from '@supabase/supabase-js';
import { applyStatusChange, promoteNextFromQueue } from '@/lib/games/apply-status';

type Row = Record<string, unknown>;

/**
 * A small in-memory stand-in for the two tables, enough for the queries these
 * functions make (select/update/delete with eq/neq, order, limit, maybeSingle).
 */
function fakeSupabase(tables: { games: Row[]; playing_queue: Row[] }) {
  const log: string[] = [];
  const client = {
    from(table: 'games' | 'playing_queue') {
      const filters: ((r: Row) => boolean)[] = [];
      let op: { kind: 'select' | 'update' | 'delete'; values?: Row } = { kind: 'select' };
      let orderBy: string | null = null;
      const rows = () => tables[table].filter((r) => filters.every((f) => f(r)));
      const run = () => {
        if (op.kind === 'update') {
          rows().forEach((r) => Object.assign(r, op.values));
          log.push(`update ${table}`);
          return { data: null, error: null };
        }
        if (op.kind === 'delete') {
          const doomed = new Set(rows());
          tables[table] = tables[table].filter((r) => !doomed.has(r));
          log.push(`delete ${table}`);
          return { data: null, error: null };
        }
        const found = [...rows()];
        if (orderBy) found.sort((a, b) => Number(a[orderBy!]) - Number(b[orderBy!]));
        return { data: found, error: null };
      };
      const builder = {
        select: () => builder,
        update: (values: Row) => {
          op = { kind: 'update', values };
          return builder;
        },
        delete: () => {
          op = { kind: 'delete' };
          return builder;
        },
        eq: (col: string, val: unknown) => {
          filters.push((r) => r[col] === val);
          return builder;
        },
        neq: (col: string, val: unknown) => {
          filters.push((r) => r[col] !== val);
          return builder;
        },
        order: (col: string) => {
          orderBy = col;
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => {
          const { data } = run();
          return { data: (data as Row[] | null)?.[0] ?? null, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => resolve(run()),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, tables, log };
}

const game = (id: number, status: string): Row => ({
  user_id: 'u',
  id,
  app_id: id + 1000,
  name: `Game ${id}`,
  status,
});

describe('applyStatusChange', () => {
  it('finishes a game with its date, notes and rating, and takes it off the queue', async () => {
    const { client, tables } = fakeSupabase({
      games: [game(1, 'playing')],
      playing_queue: [{ user_id: 'u', game_id: 1, position: 0 }],
    });

    const result = await applyStatusChange(client, 'u', {
      gameId: 1,
      status: 'finished',
      finishedAt: '2026-10-25',
      notes: 'Loved it',
      rating: 9,
    });

    expect(result).toEqual({ ok: true });
    expect(tables.games[0]).toMatchObject({
      status: 'finished',
      finished_at: '2026-10-25',
      notes: 'Loved it',
      rating: 9,
    });
    expect(tables.playing_queue).toHaveLength(0);
  });

  it('keeps one game playing by moving the old one back to the backlog', async () => {
    const { client, tables } = fakeSupabase({
      games: [game(1, 'playing'), game(2, 'backlog')],
      playing_queue: [],
    });

    await applyStatusChange(client, 'u', { gameId: 2, status: 'playing' });

    expect(tables.games.map((g) => g.status)).toEqual(['backlog', 'playing']);
  });

  it('records when a console game was last played as it stops, but not a Steam game', async () => {
    const { client, tables } = fakeSupabase({
      games: [
        { ...game(1, 'playing'), source: 'manual', platform: 'Switch' },
        { ...game(2, 'backlog'), source: 'steam', platform: 'PC' },
        { ...game(3, 'backlog'), source: 'steam', platform: 'PS5' },
      ],
      playing_queue: [],
    });

    // Starting another game stops the console one.
    await applyStatusChange(client, 'u', { gameId: 2, status: 'playing' });
    expect(tables.games[0]).toMatchObject({
      status: 'backlog',
      last_played_at: expect.any(String),
    });

    // Steam reports its own games' dates.
    await applyStatusChange(client, 'u', { gameId: 2, status: 'finished' });
    expect(tables.games[1].last_played_at).toBeUndefined();

    // A Steam game moved to a console is yours to track, like one added by hand;
    // finishing it dates it to the day you finished, even from the backlog.
    await applyStatusChange(client, 'u', {
      gameId: 3,
      status: 'finished',
      finishedAt: '2026-10-20',
    });
    expect(tables.games[2].last_played_at).toBe('2026-10-20');
  });

  it('refuses a game that is not in the library, without touching anything', async () => {
    const { client, log } = fakeSupabase({ games: [game(1, 'playing')], playing_queue: [] });

    const result = await applyStatusChange(client, 'u', { gameId: 99, status: 'playing' });

    expect(result).toEqual({ ok: false, status: 404, error: 'Game not found' });
    expect(log).toEqual([]);
  });
});

describe('promoteNextFromQueue', () => {
  it('starts the first game in the queue and returns it', async () => {
    const { client, tables } = fakeSupabase({
      games: [game(1, 'finished'), game(2, 'backlog'), game(3, 'backlog')],
      playing_queue: [
        { user_id: 'u', game_id: 3, position: 1 },
        { user_id: 'u', game_id: 2, position: 0 },
      ],
    });

    const promoted = await promoteNextFromQueue(client, 'u');

    expect(promoted).toMatchObject({ id: 2, app_id: 1002, status: 'playing' });
    expect(tables.playing_queue.map((q) => q.game_id)).toEqual([3]);
  });

  it('returns null when the queue is empty', async () => {
    const { client } = fakeSupabase({ games: [game(1, 'finished')], playing_queue: [] });
    await expect(promoteNextFromQueue(client, 'u')).resolves.toBeNull();
  });

  it('throws when a queued game no longer exists', async () => {
    const { client } = fakeSupabase({
      games: [],
      playing_queue: [{ user_id: 'u', game_id: 5, position: 0 }],
    });
    await expect(promoteNextFromQueue(client, 'u')).rejects.toThrow(/next queued game/);
  });
});
