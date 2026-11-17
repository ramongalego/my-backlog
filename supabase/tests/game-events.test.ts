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

const insertGames = async (rows: Record<string, unknown>[]): Promise<number[]> => {
  const names = Object.keys(rows[0]);
  const values = rows
    .map((_, r) => `(${names.map((_, c) => `$${r * names.length + c + 1}`).join(', ')})`)
    .join(', ');
  const added = await db.query<{ id: number }>(
    `insert into games (${names.join(', ')}) values ${values} returning id`,
    rows.flatMap((row) => names.map((name) => row[name])),
  );
  return added.map((game) => game.id);
};

/**
 * A game already in the player's library, added by hand unless told
 * otherwise. Its arrival is taken out of the history, so a test starts from a
 * game with none (the tests of arrivals use `arrive`).
 */
async function addGame(
  columns: Record<string, unknown> = {},
  userId: string = player,
): Promise<number> {
  const [id] = await insertGames([
    { user_id: userId, source: 'manual', name: 'Hades', ...columns },
  ]);
  await db.query('delete from game_events where game_id = $1', [id]);
  return id;
}

/** Games arriving in one statement, their arrival left in the history. */
const arrive = (rows: Record<string, unknown>[], userId: string = player) =>
  insertGames(rows.map((row) => ({ user_id: userId, source: 'manual', name: 'Hades', ...row })));

/** Steam games as a sync adds them: in the backlog, with the hours Steam reports. */
const steamGames = (count: number, firstAppId = 1) =>
  Array.from({ length: count }, (_, i) => ({
    source: 'steam',
    app_id: firstAppId + i,
    name: `Steam game ${firstAppId + i}`,
    playtime_forever: 0,
  }));

/** Makes the library look as if it was imported a while ago. */
const libraryIsOlder = (minutes: number) =>
  db.query(`update games set created_at = created_at - make_interval(mins => $1)`, [minutes]);

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

describe('a game arriving', () => {
  it('is recorded when it is added by hand to the backlog', async () => {
    const [game] = await arrive([{ name: 'Donkey Kong Bananza', platform: 'Switch 2' }]);
    expect(await eventsOf(game)).toEqual([
      { kind: 'added', changes: { status: [null, 'backlog'] } },
    ]);
  });

  it('is recorded with what it started with when it is added already finished', async () => {
    const [game] = await arrive([
      {
        status: 'finished',
        finished_at: '2026-11-17T00:00:00Z',
        rating: 8,
        playtime_forever: 720,
      },
    ]);
    expect(await eventsOf(game)).toEqual([
      {
        kind: 'added',
        changes: {
          status: [null, 'finished'],
          finished_at: [null, '2026-11-17T00:00:00+00:00'],
          rating: [null, 8],
          playtime_forever: [null, 720],
        },
      },
    ]);
  });

  it("is recorded when the player adds it themselves, though they can't write the history", async () => {
    const [added] = await db.asUser<{ id: number }>(
      player,
      `insert into games (user_id, source, name, status, dropped_at)
       values ($1, 'manual', 'Celeste', 'dropped', '2026-11-17T00:00:00Z') returning id`,
      [player],
    );
    await db.asUser(player, 'update games set playtime_forever = 45 where id = $1', [added.id]);

    expect(await eventsOf(added.id)).toEqual([
      {
        kind: 'added',
        changes: { status: [null, 'dropped'], dropped_at: [null, '2026-11-17T00:00:00+00:00'] },
      },
      { kind: 'playtime', changes: { playtime_forever: [0, 45] } },
    ]);
  });

  describe('from Steam', () => {
    it('is not recorded when a library is imported, however many batches it comes in', async () => {
      await arrive(steamGames(60));
      await arrive(steamGames(60, 61));
      // The last batch of an import can be small: it is still the import.
      await arrive(steamGames(3, 121));
      expect(await countEvents()).toBe(0);
    });

    it('is not recorded for a first library of one game either', async () => {
      await arrive(steamGames(1));
      expect(await countEvents()).toBe(0);
    });

    it('is recorded when it turns up later: a game bought since', async () => {
      await arrive(steamGames(60));
      await libraryIsOlder(60 * 24);

      const [bought] = await arrive([
        {
          source: 'steam',
          app_id: 1030300,
          name: 'Hollow Knight: Silksong',
          playtime_forever: 0,
        },
      ]);
      expect(await eventsOf(bought)).toEqual([
        { kind: 'added', changes: { status: [null, 'backlog'] } },
      ]);
      expect(await countEvents()).toBe(1);
    });

    it('carries the hours a game bought since has already been played', async () => {
      await arrive(steamGames(5));
      await libraryIsOlder(30);
      const [bought] = await arrive([
        { source: 'steam', app_id: 99, name: 'Balatro', playtime_forever: 140 },
      ]);
      expect(await eventsOf(bought)).toEqual([
        { kind: 'added', changes: { status: [null, 'backlog'], playtime_forever: [null, 140] } },
      ]);
    });

    it('records up to twenty arriving at once, and takes more than that for an import', async () => {
      await arrive(steamGames(5));
      await libraryIsOlder(30);

      await arrive(steamGames(20, 100));
      expect(await countEvents()).toBe(20);

      await arrive(steamGames(21, 200));
      expect(await countEvents()).toBe(20);
    });

    it("doesn't take a game added minutes into an import for one bought since", async () => {
      await arrive(steamGames(60));
      await libraryIsOlder(9);
      await arrive(steamGames(2, 61));
      expect(await countEvents()).toBe(0);
    });

    it("goes by the player's own library, not anyone else's", async () => {
      const veteran = await createUser(db);
      await arrive(steamGames(5), veteran);
      await libraryIsOlder(30);

      // A new player's first game is an import, whatever others have.
      await arrive(steamGames(1, 500));
      expect(await countEvents()).toBe(0);
    });
  });
});

describe('a change to a game', () => {
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

  it('records nothing for a change to anything else about a game', async () => {
    const game = await addGame({ status: 'finished', rating: 9 });

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

  it('keeps the arrival of a game whose first change was undone', async () => {
    const [game] = await arrive([{ name: 'Celeste' }]);
    await change(game, { status: 'wont_play' });
    await change(game, { status: 'backlog' });
    expect(await eventsOf(game)).toEqual([
      { kind: 'added', changes: { status: [null, 'backlog'] } },
    ]);
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
         values ('${player}', ${game}, 'added', '{}')`,
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

  it('cannot be run by hand: the functions belong to the triggers', async () => {
    const rows = await db.query<{ allowed: boolean }>(
      `select has_function_privilege(role, fn, 'execute') as allowed
       from unnest(array['anon', 'authenticated']) as role,
            unnest(array[
              'public.record_game_event()',
              'public.record_games_added()',
              'public.game_event_changes(jsonb, jsonb)'
            ]) as fn`,
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.allowed === false)).toBe(true);
  });
});

describe('when a game goes', () => {
  it('takes a removed game’s history with it, and leaves the rest', async () => {
    const [kept] = await arrive([{ name: 'Hades' }]);
    const [removed] = await arrive([{ name: 'Celeste', igdb_id: 2 }]);
    await change(removed, { status: 'hidden' });

    await db.asUser(player, 'delete from games where id = $1', [removed]);

    expect(await eventsOf(removed)).toEqual([]);
    expect(await eventsOf(kept)).toHaveLength(1);
  });

  it('takes all of it with a deleted account', async () => {
    const [game] = await arrive([{ name: 'Hades' }]);
    await change(game, { status: 'wont_play' });
    await db.query('delete from auth.users where id = $1', [player]);
    expect(await countEvents()).toBe(0);
  });
});

describe('when recording fails', () => {
  it('still saves the game, and the change, it was recording', async () => {
    // Every new row of history is refused.
    await db.exec('alter table game_events add constraint refuse_all check (false) not valid');
    let game: number;
    try {
      [game] = await arrive([{ name: 'Donkey Kong Bananza' }]);
      await change(game, { status: 'playing', started_at: '2026-11-17T10:00:00Z' });
      await db.query('update games set playtime_forever = 30 where id = $1', [game]);
    } finally {
      await db.exec('alter table game_events drop constraint refuse_all');
    }

    expect(await statusOf(game)).toBe('playing');
    expect(await countEvents()).toBe(0);
  });
});

describe('the migrations', () => {
  const first = sqlFile('migrations', '20261117_game_events.sql');
  const second = sqlFile('migrations', '20261117_game_events_added.sql');
  const uninstall = `
    drop trigger games_record_added on games;
    drop trigger games_record_changed on games;
    drop function public.record_games_added();
    drop function public.record_game_event();
    drop function public.game_event_changes(jsonb, jsonb);
    drop table game_events;
  `;

  const worksAsBuilt = async () => {
    const [game] = await arrive([{ name: 'Donkey Kong Bananza' }]);
    await change(game, { status: 'wont_play' });
    await age(game, 31);
    await change(game, { status: 'backlog' });
    // One row per change: each trigger is there once.
    expect((await eventsOf(game)).map((event) => event.kind)).toEqual([
      'added',
      'status',
      'status',
    ]);
  };

  it('install the history, in order, on a database that does not have it', async () => {
    await db.exec(uninstall);
    await db.exec(first);
    await db.exec(second);
    await worksAsBuilt();
  });

  it('add arrivals to a database that has the first one, keeping the history there is', async () => {
    await db.exec(uninstall);
    await db.exec(first);
    // As the first migration alone left it: a change recorded, no arrivals.
    const before = await addGame();
    await db.query('update games set playtime_forever = 30 where id = $1', [before]);

    await db.exec(second);

    expect(await eventsOf(before)).toEqual([
      { kind: 'playtime', changes: { playtime_forever: [0, 30] } },
    ]);
    await worksAsBuilt();
  });

  it('can be applied again without harm', async () => {
    await db.exec(second);
    await db.exec(first);
    await db.exec(second);
    await db.exec(second);
    await worksAsBuilt();
  });
});
