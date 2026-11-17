/**
 * @jest-environment node
 */
import { clearDatabase, createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// The history of what a player does with their games (game_events), written
// by triggers on the games table: run here against a real Postgres with the
// app's schema loaded.

interface GameEvent {
  kind: string;
  changes: Record<string, [unknown, unknown]>;
}

let db: TestDatabase;
let player: string;

/** A game in the player's library, as a Steam import adds one: in the backlog. */
async function addGame(
  columns: Record<string, unknown> = {},
  userId: string = player,
): Promise<number> {
  const row: Record<string, unknown> = {
    user_id: userId,
    source: 'manual',
    name: 'Hades',
    ...columns,
  };
  const names = Object.keys(row);
  const [game] = await db.query<{ id: number }>(
    `insert into games (${names.join(', ')})
     values (${names.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(row),
  );
  return game.id;
}

/** Changes a game as the app does: signed in as the player, through apply_status_change. */
const change = (gameId: number, update: Record<string, unknown>, userId: string = player) =>
  db.asUser(userId, 'select apply_status_change($1::jsonb)', [
    JSON.stringify([{ id: gameId, update }]),
  ]);

/** A game's history, oldest first. */
const eventsOf = (gameId: number) =>
  db.query<GameEvent>('select kind, changes from game_events where game_id = $1 order by id', [
    gameId,
  ]);

const countEvents = async () =>
  (await db.query<{ count: number }>('select count(*)::int as count from game_events'))[0].count;

/** Makes a game's history look older, as if time had passed since. */
const age = (gameId: number, seconds: number) =>
  db.query(
    `update game_events set created_at = created_at - make_interval(secs => $2) where game_id = $1`,
    [gameId, seconds],
  );

const statusOf = async (gameId: number) =>
  (await db.query<{ status: string }>('select status from games where id = $1', [gameId]))[0]
    .status;

beforeAll(async () => {
  db = await createDatabase();
}, 60_000);
afterAll(() => db?.close());
beforeEach(async () => {
  await clearDatabase(db);
  player = await createUser(db);
});

describe('what is recorded', () => {
  it('records a status change, with the dates and rating saved with it', async () => {
    const game = await addGame();
    await change(game, { status: 'playing', started_at: '2026-11-10T19:30:00Z' });
    await change(game, {
      status: 'finished',
      finished_at: '2026-11-17T00:00:00Z',
      rating: 9,
    });

    expect(await eventsOf(game)).toEqual([
      {
        kind: 'status',
        changes: {
          status: ['backlog', 'playing'],
          started_at: [null, '2026-11-10T19:30:00+00:00'],
        },
      },
      {
        kind: 'status',
        changes: {
          status: ['playing', 'finished'],
          finished_at: [null, '2026-11-17T00:00:00+00:00'],
          rating: [null, 9],
        },
      },
    ]);
  });

  it('records a date or a rating edited by itself as an edit', async () => {
    const game = await addGame({ status: 'finished', finished_at: '2026-11-01T00:00:00Z' });
    await db.query('delete from game_events');

    await change(game, { status: 'finished', finished_at: '2026-10-28T00:00:00Z' });
    await change(game, { status: 'finished', rating: 7 });

    expect(await eventsOf(game)).toEqual([
      {
        kind: 'edit',
        changes: { finished_at: ['2026-11-01T00:00:00+00:00', '2026-10-28T00:00:00+00:00'] },
      },
      { kind: 'edit', changes: { rating: [null, 7] } },
    ]);
  });

  it('records hours that went up, as a Steam refresh or an edit of them does', async () => {
    const game = await addGame({ playtime_forever: 600 });
    await db.query('update games set playtime_forever = 660 where id = $1', [game]);
    expect(await eventsOf(game)).toEqual([
      { kind: 'playtime', changes: { playtime_forever: [600, 660] } },
    ]);
  });

  it('records a game added already finished, with nothing before it', async () => {
    const game = await addGame({
      status: 'finished',
      finished_at: '2026-11-17T00:00:00Z',
      rating: 8,
      playtime_forever: 720,
    });
    expect(await eventsOf(game)).toEqual([
      {
        kind: 'status',
        changes: {
          status: [null, 'finished'],
          finished_at: [null, '2026-11-17T00:00:00+00:00'],
          rating: [null, 8],
          playtime_forever: [null, 720],
        },
      },
    ]);
  });

  it("records a player's own writes to their games, though they can't write the history", async () => {
    const [added] = await db.asUser<{ id: number }>(
      player,
      `insert into games (user_id, source, name, status, dropped_at)
       values ($1, 'manual', 'Celeste', 'dropped', '2026-11-17T00:00:00Z') returning id`,
      [player],
    );
    await db.asUser(player, 'update games set playtime_forever = 45 where id = $1', [added.id]);

    expect(await eventsOf(added.id)).toEqual([
      {
        kind: 'status',
        changes: {
          status: [null, 'dropped'],
          dropped_at: [null, '2026-11-17T00:00:00+00:00'],
          playtime_forever: [null, 0],
        },
      },
      { kind: 'playtime', changes: { playtime_forever: [0, 45] } },
    ]);
  });

  it('records each game of a move of many at once', async () => {
    const games = await Promise.all(
      Array.from({ length: 25 }, (_, i) => addGame({ name: `Game ${i}`, igdb_id: i })),
    );
    await db.asUser(player, 'select apply_status_change($1::jsonb)', [
      JSON.stringify(games.map((id) => ({ id, update: { status: 'hidden' } }))),
    ]);
    expect(await countEvents()).toBe(25);
    expect(await eventsOf(games[7])).toEqual([
      { kind: 'status', changes: { status: ['backlog', 'hidden'] } },
    ]);
  });
});

describe('what is not', () => {
  it('records nothing for games added to the backlog, as a Steam import adds them', async () => {
    await addGame({ source: 'steam', app_id: 1145360, playtime_forever: 4200 });
    await addGame({ name: 'Celeste', igdb_id: 2 });
    expect(await countEvents()).toBe(0);
  });

  it('records nothing for a change to anything else about a game', async () => {
    const game = await addGame({ status: 'finished', rating: 9 });
    await db.query('delete from game_events');

    await db.query(
      `update games set name = 'Hades II', notes = 'Great', main_story_hours = 22,
         header_image = 'https://example.com/a.jpg', last_played_at = now(), tags = '{roguelike}'
       where id = $1`,
      [game],
    );
    // And saving the same values again, as a sync does.
    await db.query(
      'update games set playtime_forever = playtime_forever, rating = 9 where id = $1',
      [game],
    );
    expect(await countEvents()).toBe(0);
  });
});

describe('a change that is undone', () => {
  it('leaves no trace when the status is put straight back', async () => {
    const game = await addGame({ status: 'playing', started_at: '2026-11-10T19:30:00Z' });
    await db.query('delete from game_events');

    await change(game, { status: 'finished', finished_at: '2026-11-17T00:00:00Z', rating: 9 });
    expect(await countEvents()).toBe(1);
    // Undo: back as it was.
    await change(game, { status: 'playing', finished_at: null, rating: null });

    expect(await countEvents()).toBe(0);
    expect(await statusOf(game)).toBe('playing');
  });

  it('still takes the change out when something else about the game changed in between', async () => {
    const game = await addGame({ playtime_forever: 60 });
    await change(game, { status: 'dropped', dropped_at: '2026-11-17T00:00:00Z' });
    await db.query('update games set playtime_forever = 90 where id = $1', [game]);
    await change(game, { status: 'backlog', dropped_at: null });

    expect(await eventsOf(game)).toEqual([
      { kind: 'playtime', changes: { playtime_forever: [60, 90] } },
    ]);
  });

  it('keeps both changes when the status goes back later: that is a change of mind', async () => {
    const game = await addGame();
    await change(game, { status: 'wont_play' });
    await age(game, 31);
    await change(game, { status: 'backlog' });

    expect((await eventsOf(game)).map((event) => event.changes.status)).toEqual([
      ['backlog', 'wont_play'],
      ['wont_play', 'backlog'],
    ]);
  });

  it('keeps both changes when the status moves on to a third', async () => {
    const game = await addGame();
    await change(game, { status: 'playing', started_at: '2026-11-17T10:00:00Z' });
    await change(game, { status: 'dropped', dropped_at: '2026-11-17T00:00:00Z' });

    expect((await eventsOf(game)).map((event) => event.changes.status)).toEqual([
      ['backlog', 'playing'],
      ['playing', 'dropped'],
    ]);
  });

  it('undoes a move of many games at once, game by game', async () => {
    const games = await Promise.all(
      Array.from({ length: 10 }, (_, i) => addGame({ name: `Game ${i}`, igdb_id: i })),
    );
    const move = (status: string) =>
      db.asUser(player, 'select apply_status_change($1::jsonb)', [
        JSON.stringify(games.map((id) => ({ id, update: { status } }))),
      ]);
    await move('hidden');
    expect(await countEvents()).toBe(10);
    await move('backlog');
    expect(await countEvents()).toBe(0);
  });
});

describe('whose it is', () => {
  it('lets a player read their own history and nobody else’s', async () => {
    const other = await createUser(db);
    const mine = await addGame();
    const theirs = await addGame({ name: 'Celeste' }, other);
    await change(mine, { status: 'wont_play' });
    await change(theirs, { status: 'hidden' }, other);

    const seen = await db.asUser<{ game_id: number }>(player, 'select game_id from game_events');
    expect(seen).toEqual([{ game_id: mine }]);
  });

  it('lets nobody write it but the triggers', async () => {
    const game = await addGame();
    await change(game, { status: 'wont_play' });

    for (const attempt of [
      `insert into game_events (user_id, game_id, kind, changes)
         values ('${player}', ${game}, 'status', '{}')`,
      `update game_events set kind = 'edit'`,
      `delete from game_events`,
    ]) {
      await expect(db.asUser(player, attempt)).rejects.toThrow(/permission denied/);
    }
    expect(await eventsOf(game)).toHaveLength(1);
  });

  it('shows a signed-out visitor nothing', async () => {
    const game = await addGame();
    await change(game, { status: 'wont_play' });
    await expect(db.asVisitor('select * from game_events')).rejects.toThrow(/permission denied/);
  });

  it('cannot be run by hand: the function belongs to the triggers', async () => {
    const rows = await db.query<{ role: string; allowed: boolean }>(
      `select role, has_function_privilege(role, 'public.record_game_event()', 'execute') as allowed
       from unnest(array['anon', 'authenticated']) as role`,
    );
    expect(rows).toEqual([
      { role: 'anon', allowed: false },
      { role: 'authenticated', allowed: false },
    ]);
  });
});

describe('when a game goes', () => {
  it('takes a removed game’s history with it, and leaves the rest', async () => {
    const kept = await addGame();
    const removed = await addGame({ name: 'Celeste', igdb_id: 2 });
    await change(kept, { status: 'wont_play' });
    await change(removed, { status: 'hidden' });

    await db.asUser(player, 'delete from games where id = $1', [removed]);

    expect(await eventsOf(removed)).toEqual([]);
    expect(await eventsOf(kept)).toHaveLength(1);
  });

  it('takes all of it with a deleted account', async () => {
    const game = await addGame();
    await change(game, { status: 'wont_play' });
    await db.query('delete from auth.users where id = $1', [player]);
    expect(await countEvents()).toBe(0);
  });
});

describe('when recording fails', () => {
  it('still saves the change it was recording', async () => {
    const game = await addGame();
    // Every new row of history is refused.
    await db.exec('alter table game_events add constraint refuse_all check (false) not valid');
    try {
      await change(game, { status: 'playing', started_at: '2026-11-17T10:00:00Z' });
      await db.query('update games set playtime_forever = 30 where id = $1', [game]);
    } finally {
      await db.exec('alter table game_events drop constraint refuse_all');
    }

    expect(await statusOf(game)).toBe('playing');
    expect(await countEvents()).toBe(0);
  });
});

describe('the migration', () => {
  const migration = sqlFile('migrations', '20261117_game_events.sql');

  it('installs the history on a database that does not have it', async () => {
    await db.exec(`
      drop trigger games_record_added on games;
      drop trigger games_record_changed on games;
      drop function public.record_game_event();
      drop table game_events;
    `);
    await db.exec(migration);

    const game = await addGame();
    await change(game, { status: 'wont_play' });
    expect(await eventsOf(game)).toEqual([
      { kind: 'status', changes: { status: ['backlog', 'wont_play'] } },
    ]);
  });

  it('can be applied again without harm, keeping the history there is', async () => {
    const game = await addGame();
    await change(game, { status: 'wont_play' });

    await db.exec(migration);
    await db.exec(migration);

    await age(game, 31);
    await change(game, { status: 'backlog' });
    // One row per change: the triggers were replaced, not added to.
    expect(await eventsOf(game)).toHaveLength(2);
  });
});
