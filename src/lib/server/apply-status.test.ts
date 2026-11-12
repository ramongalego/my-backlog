import type { SupabaseClient } from '@supabase/supabase-js';
import { applyStatusChange, promoteNextFromQueue } from '@/lib/server/apply-status';

type Row = Record<string, unknown>;

/**
 * A small in-memory stand-in for the two tables, enough for the queries these
 * functions make (select with eq/neq, order, limit, maybeSingle), and for
 * apply_status_change, which saves a change the way the database function
 * does: every write, or none of them. (The function itself is checked against
 * a real Postgres; see supabase/migrations/20261112_apply_status_change.sql.)
 */
function fakeSupabase(
  tables: { games: Row[]; playing_queue: Row[] },
  { failOnGame }: { failOnGame?: number } = {},
) {
  const log: string[] = [];
  const client = {
    async rpc(
      name: string,
      args: { p_updates: { id: number; update: Row }[]; p_pause_ids: number[] },
    ) {
      if (name !== 'apply_status_change') throw new Error(`unexpected rpc ${name}`);
      log.push('rpc apply_status_change');
      // Work on copies, so a failure part-way leaves the tables as they were.
      const games = tables.games.map((g) => ({ ...g }));
      let queue = tables.playing_queue.map((q) => ({ ...q }));
      for (const { id, update } of args.p_updates) {
        const row = games.find((g) => g.user_id === 'u' && g.id === id);
        if (!row) return { data: null, error: { code: 'P0002', message: 'Game not found' } };
        if (id === failOnGame) return { data: null, error: { code: '23514', message: 'boom' } };
        // JSON drops undefined values, as the request to the database does.
        Object.assign(row, JSON.parse(JSON.stringify(update)));
        if (update.status !== 'backlog') queue = queue.filter((q) => q.game_id !== id);
      }
      if (games.filter((g) => g.status === 'playing').length > 1)
        return { data: null, error: { code: '23505', message: 'one playing game' } };
      const top = Math.min(1, ...queue.map((q) => Number(q.position))) - 1;
      args.p_pause_ids.forEach((id, i) =>
        queue.push({ user_id: 'u', game_id: id, position: top - i }),
      );
      tables.games.splice(0, tables.games.length, ...games);
      tables.playing_queue = queue;
      return { data: null, error: null };
    },
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
        insert: (rows: Row[]) => {
          tables[table].push(...rows);
          log.push(`insert ${table}`);
          return Promise.resolve({ data: null, error: null });
        },
        eq: (col: string, val: unknown) => {
          filters.push((r) => r[col] === val);
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          filters.push((r) => vals.includes(r[col]));
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

    expect(result).toEqual({ ok: true, paused: [] });
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

  it('saves all of a change or none of it', async () => {
    // Starting game 2 moves game 1 to the backlog first; then saving game 2 fails.
    const { client, tables } = fakeSupabase(
      {
        games: [game(1, 'playing'), game(2, 'backlog')],
        playing_queue: [{ user_id: 'u', game_id: 2, position: 0 }],
      },
      { failOnGame: 2 },
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await applyStatusChange(client, 'u', { gameId: 2, status: 'playing' });

    expect(result).toEqual({ ok: false, status: 500, error: 'Failed to update game status' });
    expect(tables.games.map((g) => g.status)).toEqual(['playing', 'backlog']);
    expect(tables.playing_queue).toHaveLength(1);
  });

  it('sends every write in one call, the game that stops playing first', async () => {
    const { client, log } = fakeSupabase({
      games: [game(1, 'playing'), game(2, 'backlog')],
      playing_queue: [],
    });
    const rpc = jest.spyOn(client, 'rpc');

    await applyStatusChange(client, 'u', { gameId: 2, status: 'playing', pausePlaying: true });

    expect(log).toEqual(['rpc apply_status_change']);
    expect(rpc).toHaveBeenCalledWith('apply_status_change', {
      p_updates: [
        { id: 1, update: { status: 'backlog' } },
        { id: 2, update: { status: 'playing', started_at: expect.any(String) } },
      ],
      p_pause_ids: [1],
    });
  });

  it('says the game is gone if it was removed while the change was being saved', async () => {
    const { client, tables } = fakeSupabase({ games: [game(1, 'backlog')], playing_queue: [] });
    const rpc = client.rpc.bind(client);
    jest.spyOn(client, 'rpc').mockImplementation(((name: string, args: never) => {
      tables.games.length = 0;
      return rpc(name, args);
    }) as never);

    const result = await applyStatusChange(client, 'u', { gameId: 1, status: 'finished' });

    expect(result).toEqual({ ok: false, status: 404, error: 'Game not found' });
  });

  it('refuses a game that is not in the library, without touching anything', async () => {
    const { client, log } = fakeSupabase({ games: [game(1, 'playing')], playing_queue: [] });

    const result = await applyStatusChange(client, 'u', { gameId: 99, status: 'playing' });

    expect(result).toEqual({ ok: false, status: 404, error: 'Game not found' });
    expect(log).toEqual([]);
  });
});

describe('switching games (pausePlaying)', () => {
  const queueOrder = (rows: Row[]) =>
    [...rows].sort((a, b) => Number(a.position) - Number(b.position)).map((q) => q.game_id);

  it('pauses the playing game at the top of the queue, keeping its start date', async () => {
    const { client, tables } = fakeSupabase({
      games: [
        { ...game(1, 'playing'), started_at: '2026-10-30T19:24:07Z' },
        game(2, 'backlog'),
        game(3, 'backlog'),
      ],
      playing_queue: [
        { user_id: 'u', game_id: 2, position: 0 },
        { user_id: 'u', game_id: 3, position: 1 },
      ],
    });

    const result = await applyStatusChange(client, 'u', {
      gameId: 3,
      status: 'playing',
      pausePlaying: true,
    });

    expect(result).toEqual({ ok: true, paused: [{ id: 1, name: 'Game 1' }] });
    expect(tables.games[0]).toMatchObject({
      status: 'backlog',
      started_at: '2026-10-30T19:24:07Z',
    });
    expect(tables.games[2].status).toBe('playing');
    expect(queueOrder(tables.playing_queue)).toEqual([1, 2]);
  });

  it('resumes a paused game with its old start date', async () => {
    const { client, tables } = fakeSupabase({
      games: [
        { ...game(1, 'backlog'), started_at: '2026-10-30T19:24:07Z' },
        { ...game(2, 'playing'), started_at: '2026-11-07T10:00:00Z' },
      ],
      playing_queue: [{ user_id: 'u', game_id: 1, position: -1 }],
    });

    await applyStatusChange(client, 'u', { gameId: 1, status: 'playing', pausePlaying: true });

    expect(tables.games[0]).toMatchObject({
      status: 'playing',
      started_at: '2026-10-30T19:24:07Z',
    });
    expect(tables.games[1]).toMatchObject({
      status: 'backlog',
      started_at: '2026-11-07T10:00:00Z',
    });
    expect(queueOrder(tables.playing_queue)).toEqual([2]);
  });

  it('starts afresh a game with a start date that is no longer queued', async () => {
    const { client, tables } = fakeSupabase({
      games: [{ ...game(1, 'backlog'), started_at: '2026-10-30T19:24:07Z' }],
      playing_queue: [],
    });

    await applyStatusChange(client, 'u', { gameId: 1, status: 'playing' });

    expect(tables.games[0].started_at).not.toBe('2026-10-30T19:24:07Z');
  });

  it('without pausePlaying, sends the playing game to the backlog as before', async () => {
    const { client, tables } = fakeSupabase({
      games: [{ ...game(1, 'playing'), started_at: '2026-10-30T19:24:07Z' }, game(2, 'backlog')],
      playing_queue: [],
    });

    await applyStatusChange(client, 'u', { gameId: 2, status: 'playing' });

    expect(tables.games[0]).toMatchObject({ status: 'backlog', started_at: null });
    expect(tables.playing_queue).toEqual([]);
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

  it("skips games that aren't out yet, leaving them queued", async () => {
    const nextYear = new Date().getFullYear() + 1;
    const { client, tables } = fakeSupabase({
      games: [
        { ...game(2, 'backlog'), release_date: `Jan 28, ${nextYear}` },
        { ...game(3, 'backlog'), release_date: 'Coming soon' },
        { ...game(4, 'backlog'), release_date: 'Sep 28, 2010' },
      ],
      playing_queue: [
        { user_id: 'u', game_id: 2, position: 0 },
        { user_id: 'u', game_id: 3, position: 1 },
        { user_id: 'u', game_id: 4, position: 2 },
      ],
    });

    expect(await promoteNextFromQueue(client, 'u')).toMatchObject({ id: 4, status: 'playing' });
    expect(tables.playing_queue.map((q) => q.game_id)).toEqual([2, 3]);
  });

  it('after a switch, finishing goes back to the paused game with its start date', async () => {
    const { client, tables } = fakeSupabase({
      games: [
        { ...game(1, 'playing'), started_at: '2026-10-30T19:24:07Z' },
        game(2, 'backlog'),
        game(3, 'backlog'),
      ],
      playing_queue: [
        { user_id: 'u', game_id: 2, position: 0 },
        { user_id: 'u', game_id: 3, position: 1 },
      ],
    });

    // Switch to game 3, then finish it.
    await applyStatusChange(client, 'u', { gameId: 3, status: 'playing', pausePlaying: true });
    await applyStatusChange(client, 'u', { gameId: 3, status: 'finished' });
    const promoted = await promoteNextFromQueue(client, 'u');

    expect(promoted).toMatchObject({
      id: 1,
      status: 'playing',
      started_at: '2026-10-30T19:24:07Z',
    });
    expect(tables.games[2].status).toBe('finished');
    expect(tables.playing_queue.map((q) => q.game_id)).toEqual([2]);
  });

  it('returns null when nothing queued is out yet', async () => {
    const { client, tables } = fakeSupabase({
      games: [{ ...game(2, 'backlog'), release_date: 'To be announced' }],
      playing_queue: [{ user_id: 'u', game_id: 2, position: 0 }],
    });
    await expect(promoteNextFromQueue(client, 'u')).resolves.toBeNull();
    expect(tables.playing_queue).toHaveLength(1);
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
