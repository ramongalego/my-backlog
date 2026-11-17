/**
 * @jest-environment node
 */
import { clearDatabase, createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// The history of what a player does with their games (game_events), written
// by triggers on the games table: run here against a real Postgres. Every
// behavior is checked twice, on a database built from schema.sql and on one
// brought up by the migrations, so the two can't drift apart.

interface GameEvent {
  kind: string;
  changes: Record<string, [unknown, unknown]>;
}

const MIGRATIONS = [
  '20261117_game_events.sql',
  '20261117_game_events_added.sql',
  '20261117_game_events_merged.sql',
  '20261117_game_events_queue.sql',
].map((file) => sqlFile('migrations', file));

/** Takes the history out of a database, as it was before the first migration. */
const UNINSTALL = `
  drop trigger if exists games_record_added on games;
  drop trigger if exists games_record_changed on games;
  drop trigger if exists playing_queue_record_added on playing_queue;
  drop trigger if exists playing_queue_record_removed on playing_queue;
  drop function if exists public.record_queue_event();
  drop function if exists public.game_event_record(uuid, bigint, jsonb);
  drop function if exists public.record_games_added();
  drop function if exists public.record_game_event();
  drop function if exists public.game_event_snapshot(public.games);
  drop function if exists public.game_event_changes(jsonb, jsonb);
  drop function if exists public.game_event_net(jsonb, jsonb);
  drop function if exists public.game_event_kind(jsonb);
  drop function if exists public.game_event_arrival(jsonb);
  drop table if exists game_events;
`;

const BUILDS: [string, () => Promise<TestDatabase>][] = [
  ['built from schema.sql', createDatabase],
  [
    'brought up by the migrations',
    async () => {
      const db = await createDatabase();
      await db.exec(UNINSTALL);
      for (const migration of MIGRATIONS) await db.exec(migration);
      return db;
    },
  ],
];

describe.each(BUILDS)('the history, on a database %s', (_, build) => {
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
   * otherwise. Its arrival is taken out of the history, so a test starts
   * from a game with none (the tests of arrivals use `arrive`).
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

  /** Steam games as a sync adds them: in the backlog, on PC, with Steam's hours. */
  const steamGames = (count: number, firstAppId = 1) =>
    Array.from({ length: count }, (_, i) => ({
      source: 'steam',
      app_id: firstAppId + i,
      name: `Steam game ${firstAppId + i}`,
      platform: 'PC',
      playtime_forever: 0,
    }));

  /** Makes the library look as if it was imported a while ago. */
  const libraryIsOlder = (minutes: number) =>
    db.query(`update games set created_at = created_at - make_interval(mins => $1)`, [minutes]);

  /**
   * Changes games as the app does: signed in as the player, through
   * apply_status_change, in one transaction. `undo` sends them as an Undo.
   */
  const changeAll = (
    items: { id: number; update: Record<string, unknown> }[],
    {
      undo = false,
      userId = player,
      timeZone = undefined as string | undefined,
      /** Games put at the top of the queue in the same save: one paused for another. */
      toQueue = [] as number[],
    } = {},
  ) =>
    db.asUser(
      userId,
      'select apply_status_change($1::jsonb, $2::bigint[])',
      [JSON.stringify(items.map((item) => (undo ? { ...item, undo: true } : item))), toQueue],
      timeZone,
    );
  const change = (
    id: number,
    update: Record<string, unknown>,
    options: { undo?: boolean; userId?: string; timeZone?: string; toQueue?: number[] } = {},
  ) => changeAll([{ id, update }], options);

  /** Puts a game on the player's queue, or takes it off, as the queue's route does. */
  const queue = (id: number, position = 0) =>
    db.asUser(
      player,
      'insert into playing_queue (user_id, game_id, position) values ($1, $2, $3)',
      [player, id, position],
    );
  const unqueue = (id: number) =>
    db.asUser(player, 'delete from playing_queue where game_id = $1', [id]);
  const queued = async () =>
    (
      await db.query<{ game_id: number }>(
        'select game_id from playing_queue where user_id = $1 order by position',
        [player],
      )
    ).map((row) => row.game_id);

  /** A write to the player's own game that isn't a status change, as its routes make. */
  const write = (id: number, set: string, params: unknown[] = []) =>
    db.asUser(player, `update games set ${set} where id = $${params.length + 1}`, [...params, id]);

  /** A game's history, oldest first. */
  const eventsOf = (gameId: number) =>
    db.query<GameEvent>('select kind, changes from game_events where game_id = $1 order by id', [
      gameId,
    ]);

  const countEvents = async () =>
    (await db.query<{ count: number }>('select count(*)::int as count from game_events'))[0].count;

  /** Time passes: every event so far is this much older. 31 seconds ends a sitting. */
  const later = (seconds = 31) =>
    db.query(
      `update game_events
       set created_at = created_at - make_interval(secs => $1),
           updated_at = updated_at - make_interval(secs => $1)`,
      [seconds],
    );

  const statusOf = async (gameId: number) =>
    (await db.query<{ status: string }>('select status from games where id = $1', [gameId]))[0]
      .status;

  beforeAll(async () => {
    db = await build();
  }, 60_000);
  afterAll(() => db?.close());
  beforeEach(async () => {
    await clearDatabase(db);
    player = await createUser(db);
  });

  describe('a game arriving', () => {
    it('is recorded when it is added by hand to the backlog, with where it is played', async () => {
      const [game] = await arrive([{ name: 'Donkey Kong Bananza', platform: 'Switch 2' }]);
      expect(await eventsOf(game)).toEqual([
        { kind: 'added', changes: { status: [null, 'backlog'], platform: [null, 'Switch 2'] } },
      ]);
    });

    it('is one event when it is added as finished, which the app saves in two steps', async () => {
      // Add game: the row goes in as backlog, then its status is set.
      const [game] = await arrive([{ platform: 'Switch 2', playtime_forever: 720 }]);
      await change(game, {
        status: 'finished',
        finished_at: '2026-11-15T00:00:00Z',
        rating: 7,
        last_played_at: '2026-11-15T00:00:00Z',
      });

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'added',
          changes: {
            status: [null, 'finished'],
            finished_at: [null, '2026-11-15T00:00:00+00:00'],
            rating: [null, 7],
            playtime_forever: [null, 720],
            platform: [null, 'Switch 2'],
            last_played_at: [null, '2026-11-15T00:00:00+00:00'],
          },
        },
      ]);
    });

    it('is one event when it is added as the game being played, and the game it pauses has its own', async () => {
      const playing = await addGame({ status: 'playing', started_at: '2026-11-10T19:30:00Z' });
      const [game] = await arrive([{ name: 'Celeste', igdb_id: 2, platform: 'Switch' }]);
      await changeAll([
        { id: playing, update: { status: 'backlog' } },
        { id: game, update: { status: 'playing', started_at: '2026-11-17T20:00:00Z' } },
      ]);

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'added',
          changes: {
            status: [null, 'playing'],
            started_at: [null, '2026-11-17T20:00:00+00:00'],
            platform: [null, 'Switch'],
          },
        },
      ]);
      expect(await eventsOf(playing)).toEqual([
        { kind: 'status', changes: { status: ['playing', 'backlog'] } },
      ]);
    });

    it('takes what happens to the game later as events of their own', async () => {
      const [game] = await arrive([{ name: 'Celeste' }]);
      await later();
      await change(game, { status: 'wont_play' });
      expect((await eventsOf(game)).map((event) => event.kind)).toEqual(['added', 'status']);
    });

    it("is recorded when the player writes it themselves, though they can't write the history", async () => {
      const [added] = await db.asUser<{ id: number }>(
        player,
        `insert into games (user_id, source, name, status, dropped_at)
         values ($1, 'manual', 'Celeste', 'dropped', '2026-11-17T00:00:00Z') returning id`,
        [player],
      );
      expect(await eventsOf(added.id)).toEqual([
        {
          kind: 'added',
          changes: { status: [null, 'dropped'], dropped_at: [null, '2026-11-17T00:00:00+00:00'] },
        },
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

        // As the refresh adds it: signed in as the player.
        const [bought] = await db.asUser<{ id: number }>(
          player,
          `insert into games (user_id, source, app_id, name, platform, playtime_forever)
           values ($1, 'steam', 1030300, 'Hollow Knight: Silksong', 'PC', 0) returning id`,
          [player],
        );
        expect(await eventsOf(bought.id)).toEqual([
          { kind: 'added', changes: { status: [null, 'backlog'], platform: [null, 'PC'] } },
        ]);
        expect(await countEvents()).toBe(1);
      });

      it('carries the hours a game bought since has already been played, and when', async () => {
        await arrive(steamGames(5));
        await libraryIsOlder(30);
        const [bought] = await arrive([
          {
            source: 'steam',
            app_id: 99,
            name: 'Balatro',
            platform: 'PC',
            playtime_forever: 140,
            last_played_at: '2026-11-16T21:00:00Z',
          },
        ]);
        expect(await eventsOf(bought)).toEqual([
          {
            kind: 'added',
            changes: {
              status: [null, 'backlog'],
              platform: [null, 'PC'],
              playtime_forever: [null, 140],
              last_played_at: [null, '2026-11-16T21:00:00+00:00'],
            },
          },
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

      it("goes by each player's own library, when one statement adds games for two of them", async () => {
        const veteran = await createUser(db);
        await arrive(steamGames(5), veteran);
        await libraryIsOlder(30);

        const ids = await insertGames([
          { user_id: veteran, ...steamGames(1, 300)[0] },
          // A new player's first game is an import, whatever others have.
          { user_id: player, ...steamGames(1, 301)[0] },
        ]);
        expect(await eventsOf(ids[0])).toHaveLength(1);
        expect(await eventsOf(ids[1])).toHaveLength(0);
      });

      it('still records games added by hand in a statement that imports a Steam library', async () => {
        const columns = { name: 'x', platform: 'PC', playtime_forever: 0, app_id: null };
        const ids = await insertGames([
          ...steamGames(25).map((game) => ({ user_id: player, ...columns, ...game })),
          { user_id: player, ...columns, source: 'manual', name: 'Celeste', platform: 'Switch' },
        ]);
        expect(await countEvents()).toBe(1);
        expect(await eventsOf(ids[25])).toHaveLength(1);
      });
    });
  });

  describe('a change to a game', () => {
    it('records a status change, with the dates and rating saved with it', async () => {
      const game = await addGame();
      await change(game, { status: 'playing', started_at: '2026-11-10T19:30:00Z' });
      await later();
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

    it('records a date or a rating changed by itself as an edit', async () => {
      const game = await addGame({ status: 'finished', finished_at: '2026-11-01T00:00:00Z' });

      await change(game, { status: 'finished', finished_at: '2026-10-28T00:00:00Z' });
      await later();
      await change(game, { status: 'finished', rating: 7 });

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'edit',
          changes: { finished_at: ['2026-11-01T00:00:00+00:00', '2026-10-28T00:00:00+00:00'] },
        },
        { kind: 'edit', changes: { rating: [null, 7] } },
      ]);
    });

    it('records hours that went up, with the day they were played when it comes along', async () => {
      const game = await addGame({
        playtime_forever: 600,
        last_played_at: '2026-11-10T21:00:00Z',
      });
      // A Steam refresh: the new total, and when Steam says it was last played.
      await write(game, `playtime_forever = 660, last_played_at = '2026-11-16T22:15:00Z'`);
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'playtime',
          changes: {
            playtime_forever: [600, 660],
            last_played_at: ['2026-11-10T21:00:00+00:00', '2026-11-16T22:15:00+00:00'],
          },
        },
      ]);
    });

    it('records nothing for a new last-played date with the same hours', async () => {
      const game = await addGame({ playtime_forever: 600 });
      await write(game, `last_played_at = '2026-11-16T22:15:00Z'`);
      expect(await countEvents()).toBe(0);
    });

    it('records a Steam game moved to a console and back, so its hours can be read right', async () => {
      const game = await addGame({
        source: 'steam',
        app_id: 32370,
        platform: 'PC',
        playtime_forever: 3000,
        last_played_at: '2016-12-01T22:29:00Z',
      });

      // Added from a console: the hours become the ones entered for it.
      await write(
        game,
        `platform = 'Xbox', igdb_id = 116, playtime_forever = 300, last_played_at = null`,
      );
      await later();
      // An hour logged on the console.
      await write(game, `playtime_forever = 360, last_played_at = '2026-11-17T20:00:00Z'`);
      await later();
      // Played on Steam again: the hours stay until the next sync brings Steam's.
      await write(game, `platform = 'PC', igdb_id = null`);
      await later();
      await write(game, `playtime_forever = 3050, last_played_at = '2026-11-18T21:00:00Z'`);

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'edit',
          changes: {
            platform: ['PC', 'Xbox'],
            playtime_forever: [3000, 300],
            last_played_at: ['2016-12-01T22:29:00+00:00', null],
          },
        },
        {
          kind: 'playtime',
          changes: {
            playtime_forever: [300, 360],
            last_played_at: [null, '2026-11-17T20:00:00+00:00'],
          },
        },
        { kind: 'edit', changes: { platform: ['Xbox', 'PC'] } },
        {
          kind: 'playtime',
          changes: {
            playtime_forever: [360, 3050],
            last_played_at: ['2026-11-17T20:00:00+00:00', '2026-11-18T21:00:00+00:00'],
          },
        },
      ]);
    });

    it('records each game of a move of many at once', async () => {
      const games = await Promise.all(
        Array.from({ length: 25 }, (_, i) => addGame({ name: `Game ${i}`, igdb_id: i })),
      );
      await changeAll(games.map((id) => ({ id, update: { status: 'hidden' } })));
      expect(await countEvents()).toBe(25);
      expect(await eventsOf(games[7])).toEqual([
        { kind: 'status', changes: { status: ['backlog', 'hidden'] } },
      ]);
    });

    it('records nothing for a change to anything else about a game', async () => {
      const game = await addGame({ status: 'finished', rating: 9 });

      await write(
        game,
        `name = 'Hades II', notes = 'Great', main_story_hours = 22, reroll_count = 3,
         header_image = 'https://example.com/a.jpg', tags = '{roguelike}', source = 'manual'`,
      );
      // And saving the same values again, as a sync does.
      await write(game, 'playtime_forever = playtime_forever, rating = 9, platform = platform');
      expect(await countEvents()).toBe(0);
    });
  });

  describe('one sitting is one event', () => {
    it('folds hours typed and then corrected into the change they come to', async () => {
      const game = await addGame({ playtime_forever: 720 });
      await write(game, 'playtime_forever = 780');
      await write(game, 'playtime_forever = 750');
      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [720, 750] } },
      ]);
    });

    it('folds a status picked by mistake and corrected into where the game ended up', async () => {
      const game = await addGame();
      await change(game, { status: 'dropped', dropped_at: '2026-11-17T00:00:00Z' });
      await change(game, {
        status: 'finished',
        dropped_at: null,
        finished_at: '2026-11-17T00:00:00Z',
        rating: 8,
      });
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'status',
          changes: {
            status: ['backlog', 'finished'],
            finished_at: [null, '2026-11-17T00:00:00+00:00'],
            rating: [null, 8],
          },
        },
      ]);
    });

    it('lasts as long as changes keep coming within 30 seconds of each other', async () => {
      const game = await addGame({ playtime_forever: 0 });
      await write(game, 'playtime_forever = 10');
      await later(20);
      await write(game, 'playtime_forever = 20');
      await later(20);
      await write(game, 'playtime_forever = 30');
      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [0, 30] } },
      ]);

      await later(31);
      await write(game, 'playtime_forever = 40');
      expect((await eventsOf(game)).map((event) => event.changes.playtime_forever)).toEqual([
        [0, 30],
        [30, 40],
      ]);
    });

    it('leaves no trace of a change put straight back', async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-11-10T19:30:00Z' });

      await change(game, { status: 'finished', finished_at: '2026-11-17T00:00:00Z', rating: 9 });
      expect(await countEvents()).toBe(1);
      await change(game, { status: 'playing', finished_at: null, rating: null });

      expect(await countEvents()).toBe(0);
      expect(await statusOf(game)).toBe('playing');
    });

    it('keeps what an Undo did not put back: a game stopped and started again has a new start date', async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-11-01T18:00:00Z' });
      // Now Playing, "move to backlog", then its Undo, which starts the game afresh.
      await change(game, { status: 'backlog', started_at: null });
      await change(game, { status: 'playing', started_at: '2026-11-17T13:39:00Z' });

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'edit',
          changes: {
            started_at: ['2026-11-01T18:00:00+00:00', '2026-11-17T13:39:00+00:00'],
          },
        },
      ]);
    });

    it('leaves no trace of a switch that is undone, which the app does in three writes', async () => {
      const a = await addGame({ status: 'playing', started_at: '2026-11-13T13:57:00Z' });
      const b = await addGame({ name: 'Celeste', igdb_id: 2 });

      // Switch to B: A is paused (it keeps its start date), B starts.
      await changeAll([
        { id: a, update: { status: 'backlog' } },
        { id: b, update: { status: 'playing', started_at: '2026-11-17T13:39:00Z' } },
      ]);
      expect(await countEvents()).toBe(2);
      // Undo: A is switched back to, pausing B; then B goes back to the backlog for good.
      await changeAll([
        { id: b, update: { status: 'backlog' } },
        { id: a, update: { status: 'playing' } },
      ]);
      await change(b, { status: 'backlog', started_at: null });

      expect(await countEvents()).toBe(0);
    });

    it("leaves a finished game's history alone when it is played again and that is undone", async () => {
      const a = await addGame({ status: 'playing', started_at: '2026-11-13T13:57:00Z' });
      const b = await addGame({ name: 'Celeste', igdb_id: 2 });
      // B was finished a while ago.
      await change(b, { status: 'finished', finished_at: '2026-10-19T00:00:00Z', rating: 9 });
      await later(60 * 60 * 24 * 20);
      const finished = await eventsOf(b);

      // Diary, "play again": A paused, B started. Then Undo.
      await changeAll([
        { id: a, update: { status: 'backlog' } },
        {
          id: b,
          update: {
            status: 'playing',
            started_at: '2026-11-17T13:39:00Z',
            finished_at: null,
            rating: null,
          },
        },
      ]);
      await changeAll([
        { id: b, update: { status: 'backlog' } },
        { id: a, update: { status: 'playing' } },
      ]);
      await change(b, {
        status: 'finished',
        started_at: null,
        finished_at: '2026-10-19T00:00:00Z',
        rating: 9,
      });

      // One finish, as before: nothing says it was finished twice.
      expect(await eventsOf(b)).toEqual(finished);
      expect(await eventsOf(a)).toEqual([]);
    });

    it('keeps two changes apart when the second comes after the sitting', async () => {
      const game = await addGame();
      await change(game, { status: 'wont_play' });
      await later();
      await change(game, { status: 'backlog' });

      expect((await eventsOf(game)).map((event) => event.changes.status)).toEqual([
        ['backlog', 'wont_play'],
        ['wont_play', 'backlog'],
      ]);
    });

    it('folds changes within one save of several games, game by game', async () => {
      const games = await Promise.all(
        Array.from({ length: 10 }, (_, i) => addGame({ name: `Game ${i}`, igdb_id: i })),
      );
      const move = (status: string) => changeAll(games.map((id) => ({ id, update: { status } })));
      await move('hidden');
      expect(await countEvents()).toBe(10);
      await move('backlog');
      expect(await countEvents()).toBe(0);
    });
  });

  describe('the queue', () => {
    it('records a game going on the queue, and coming off it later', async () => {
      const game = await addGame();
      await queue(game);
      expect(await eventsOf(game)).toEqual([{ kind: 'queue', changes: { queued: [false, true] } }]);

      await later();
      await unqueue(game);
      expect(await eventsOf(game)).toEqual([
        { kind: 'queue', changes: { queued: [false, true] } },
        { kind: 'queue', changes: { queued: [true, false] } },
      ]);
    });

    it('leaves no trace of a game queued and taken straight off again', async () => {
      const game = await addGame();
      await queue(game);
      await unqueue(game);
      expect(await countEvents()).toBe(0);
    });

    it('records nothing when the queue is reordered', async () => {
      const games = [await addGame({ igdb_id: 1 }), await addGame({ igdb_id: 2 })];
      await queue(games[0], 0);
      await queue(games[1], 1);
      await later();
      const before = await countEvents();

      await db.asUser(player, 'select reorder_queue($1::bigint[])', [[games[1], games[0]]]);
      expect(await queued()).toEqual([games[1], games[0]]);
      expect(await countEvents()).toBe(before);
    });

    it('is one event when a queued game is started: its status, and off the queue', async () => {
      const game = await addGame();
      await queue(game);
      await later();
      // The save takes a game that leaves the backlog off the queue itself.
      await change(game, { status: 'playing', started_at: '2026-11-17T20:00:00Z' });

      expect(await queued()).toEqual([]);
      expect((await eventsOf(game)).slice(1)).toEqual([
        {
          kind: 'status',
          changes: {
            status: ['backlog', 'playing'],
            started_at: [null, '2026-11-17T20:00:00+00:00'],
            queued: [true, false],
          },
        },
      ]);
    });

    it('is one event when a game is paused for another: back to the backlog, and onto the queue', async () => {
      const playing = await addGame({ status: 'playing', started_at: '2026-11-13T13:57:00Z' });
      const next = await addGame({ name: 'Celeste', igdb_id: 2 });
      await changeAll(
        [
          { id: playing, update: { status: 'backlog' } },
          { id: next, update: { status: 'playing', started_at: '2026-11-17T20:00:00Z' } },
        ],
        { toQueue: [playing] },
      );

      expect(await queued()).toEqual([playing]);
      expect(await eventsOf(playing)).toEqual([
        { kind: 'status', changes: { status: ['playing', 'backlog'], queued: [false, true] } },
      ]);
    });

    it('is part of the arrival of a game added by hand straight to the queue', async () => {
      const [game] = await arrive([{ name: 'Metroid Dread', platform: 'Switch' }]);
      await queue(game);
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'added',
          changes: {
            status: [null, 'backlog'],
            platform: [null, 'Switch'],
            queued: [null, true],
          },
        },
      ]);
    });

    it('leaves no trace of a switch to a queued game that is undone, late, with its queue put back', async () => {
      const a = await addGame({ status: 'playing', started_at: '2026-11-13T13:57:00Z' });
      const b = await addGame({ name: 'Celeste', igdb_id: 2 });
      const c = await addGame({ name: 'Hollow Knight', igdb_id: 3 });
      await queue(c, 0);
      await queue(b, 1);
      await later(60 * 60);
      const before = await db.query('select id, kind, changes from game_events order by id');

      // Play on B's queue row: A is paused at the top of the queue, B starts.
      await changeAll(
        [
          { id: a, update: { status: 'backlog' } },
          { id: b, update: { status: 'playing', started_at: '2026-11-17T20:00:00Z' } },
        ],
        { toQueue: [a] },
      );
      expect(await queued()).toEqual([a, c]);

      // Ten minutes later, Undo: A is switched back to (pausing B at the top),
      // B's start is cleared, and the queue goes back in its old order.
      await later(600);
      await changeAll(
        [
          { id: b, update: { status: 'backlog' } },
          { id: a, update: { status: 'playing' } },
        ],
        { undo: true, toQueue: [b] },
      );
      await change(b, { status: 'backlog', started_at: null }, { undo: true });
      await db.asUser(player, 'select reorder_queue($1::bigint[])', [[c, b]]);

      expect(await queued()).toEqual([c, b]);
      expect(await db.query('select id, kind, changes from game_events order by id')).toEqual(
        before,
      );
    });

    it("doesn't record a queued game being removed from the library as coming off the queue", async () => {
      const kept = await addGame({ igdb_id: 1 });
      const removed = await addGame({ name: 'Celeste', igdb_id: 2 });
      await queue(kept, 0);
      await queue(removed, 1);
      await later();

      await db.asUser(player, 'delete from games where id = $1', [removed]);

      expect(await queued()).toEqual([kept]);
      expect(await eventsOf(removed)).toEqual([]);
      expect(await eventsOf(kept)).toHaveLength(1);
    });

    it('goes with a deleted account, queue and all', async () => {
      const game = await addGame();
      await queue(game);
      await db.query('delete from auth.users where id = $1', [player]);
      expect(await countEvents()).toBe(0);
    });

    it('still saves the queue when the history refuses the row', async () => {
      const game = await addGame();
      await db.exec('alter table game_events add constraint refuse_all check (false) not valid');
      try {
        await queue(game);
      } finally {
        await db.exec('alter table game_events drop constraint refuse_all');
      }
      expect(await queued()).toEqual([game]);
      expect(await countEvents()).toBe(0);
    });
  });

  describe('an Undo the app sends as one', () => {
    it('is folded into the change it undoes however late it comes', async () => {
      const games = await Promise.all(
        [1, 2, 3].map((i) =>
          addGame({
            name: `Game ${i}`,
            igdb_id: i,
            status: 'finished',
            finished_at: '2026-10-19T00:00:00Z',
            rating: 8,
          }),
        ),
      );
      // Games, Select: three finished games moved to Hidden, which clears
      // their date and rating.
      await changeAll(
        games.map((id) => ({ id, update: { status: 'hidden', finished_at: null, rating: null } })),
      );
      expect(await countEvents()).toBe(3);
      // The tab was in the background: Undo is pressed ten minutes later.
      await later(600);
      await changeAll(
        games.map((id) => ({
          id,
          update: { status: 'finished', finished_at: '2026-10-19T00:00:00Z', rating: 8 },
        })),
        { undo: true },
      );

      // Not a second finish for each: no trace at all.
      expect(await countEvents()).toBe(0);
    });

    it('would otherwise read as a second change: the same Undo, not said to be one', async () => {
      const game = await addGame({ status: 'finished', finished_at: '2026-10-19T00:00:00Z' });
      await change(game, { status: 'hidden', finished_at: null });
      await later(600);
      await change(game, { status: 'finished', finished_at: '2026-10-19T00:00:00Z' });
      expect((await eventsOf(game)).map((event) => event.changes.status)).toEqual([
        ['finished', 'hidden'],
        ['hidden', 'finished'],
      ]);
    });

    it('leaves no trace of a game stopped and started again, now that its dates are put back', async () => {
      const game = await addGame({
        platform: 'Switch 2',
        status: 'playing',
        started_at: '2026-11-13T13:57:00Z',
        last_played_at: '2026-11-16T12:11:00Z',
      });
      // Now Playing, "move to backlog": the start date goes, last played is stamped.
      await change(game, {
        status: 'backlog',
        started_at: null,
        last_played_at: '2026-11-17T15:15:00Z',
      });
      await later(600);
      // Its Undo, as the app sends it: started when it had been, last played as before.
      await change(
        game,
        {
          status: 'playing',
          started_at: '2026-11-13T13:57:00Z',
          last_played_at: '2026-11-16T12:11:00Z',
        },
        { undo: true },
      );
      expect(await eventsOf(game)).toEqual([]);
    });

    it('keeps what it did not put back', async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-11-01T18:00:00Z' });
      await change(game, { status: 'backlog', started_at: null });
      await later(600);
      await change(game, { status: 'playing', started_at: '2026-11-17T13:39:00Z' }, { undo: true });
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'edit',
          changes: {
            started_at: ['2026-11-01T18:00:00+00:00', '2026-11-17T13:39:00+00:00'],
          },
        },
      ]);
    });

    it('only marks the changes sent as one, and only for that save', async () => {
      const undone = await addGame({ name: 'Undone', igdb_id: 1 });
      const other = await addGame({ name: 'Other', igdb_id: 2 });
      await changeAll([
        { id: undone, update: { status: 'hidden' } },
        { id: other, update: { status: 'hidden' } },
      ]);
      await later(600);

      // One save with an Undo for one game and an ordinary change for the other.
      await db.asUser(player, 'select apply_status_change($1::jsonb)', [
        JSON.stringify([
          { id: undone, update: { status: 'backlog' }, undo: true },
          { id: other, update: { status: 'backlog' } },
        ]),
      ]);
      expect(await eventsOf(undone)).toEqual([]);
      expect(await eventsOf(other)).toHaveLength(2);

      // And nothing is left set for the next save.
      await later(600);
      await change(other, { status: 'wont_play' });
      expect(await eventsOf(other)).toHaveLength(3);
    });
  });

  describe('dates', () => {
    it('are written in UTC, whatever time zone the session asked for', async () => {
      const game = await addGame();
      await change(
        game,
        { status: 'finished', finished_at: '2026-11-17T00:00:00Z' },
        { timeZone: 'America/New_York' },
      );
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'status',
          changes: {
            status: ['backlog', 'finished'],
            finished_at: [null, '2026-11-17T00:00:00+00:00'],
          },
        },
      ]);
    });

    it('cancel when the same moment is written from two time zones', async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-11-10T19:30:00Z' });
      await change(game, { status: 'backlog', started_at: null }, { timeZone: 'Asia/Tokyo' });
      await change(
        game,
        { status: 'playing', started_at: '2026-11-10T19:30:00Z' },
        { timeZone: 'America/New_York' },
      );
      expect(await countEvents()).toBe(0);
    });
  });

  describe('replaying it', () => {
    it('gives the game as it is now, whatever was done to it and whenever', async () => {
      const game = await addGame({ platform: 'PC', playtime_forever: 100 });
      const snapshot = async () =>
        (
          await db.query<{ row: Record<string, unknown> }>(
            `select public.game_event_snapshot(g) || jsonb_build_object(
               'queued', exists (select 1 from playing_queue q where q.game_id = g.id)
             ) as row
             from games g where g.id = $1`,
            [game],
          )
        )[0].row;
      const before = await snapshot();

      // The same sequence every run.
      let seed = 20261117;
      const random = (below: number) => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % below;
      };
      const day = () => `2026-${String(1 + random(11)).padStart(2, '0')}-1${random(9)}T00:00:00Z`;
      const statuses = ['backlog', 'playing', 'finished', 'dropped', 'wont_play', 'hidden'];

      for (let step = 0; step < 120; step++) {
        const what = random(7);
        if (what === 0) {
          await change(
            game,
            {
              status: statuses[random(statuses.length)],
              ...(random(2) ? { started_at: random(3) ? day() : null } : {}),
              ...(random(2) ? { finished_at: random(3) ? day() : null } : {}),
              ...(random(2) ? { dropped_at: random(3) ? day() : null } : {}),
              ...(random(2) ? { rating: random(4) ? random(11) : null } : {}),
            },
            {
              undo: random(4) === 0,
              timeZone: ['UTC', 'Asia/Tokyo', 'America/New_York'][random(3)],
            },
          );
        } else if (what === 1) {
          await write(game, `playtime_forever = ${random(5000)}`);
        } else if (what === 2) {
          await write(game, `platform = '${['PC', 'Xbox', 'Switch 2'][random(3)]}'`);
        } else if (what === 3) {
          await write(game, `playtime_forever = ${random(5000)}, last_played_at = '${day()}'`);
        } else if (what === 4) {
          await write(game, `rating = ${random(11)}, finished_at = '${day()}'`);
        } else if (what === 5) {
          // On the queue, or off it. (A status change away from the backlog
          // takes a game off by itself.)
          if ((await queued()).includes(game)) await unqueue(game);
          else await queue(game);
        } else {
          await write(game, `last_played_at = '${day()}', name = 'Hades ${step}'`);
        }
        // Sometimes the next change is part of the same sitting, sometimes not.
        if (random(3) === 0) await later(31);
      }

      const state: Record<string, unknown> = { ...before };
      const events = await eventsOf(game);
      for (const event of events) {
        expect(['status', 'edit', 'queue', 'playtime']).toContain(event.kind);
        expect(Object.keys(event.changes).length).toBeGreaterThan(0);
        for (const [column, [was, isNow]] of Object.entries(event.changes)) {
          // When it was last played also changes by itself, unrecorded.
          if (column !== 'last_played_at') expect([column, state[column]]).toEqual([column, was]);
          state[column] = isNow;
        }
      }
      const now = await snapshot();
      delete state.last_played_at;
      delete now.last_played_at;
      expect(state).toEqual(now);
      // Folded, not one event per write.
      expect(events.length).toBeLessThan(120);
    }, 60_000);
  });

  describe('whose it is', () => {
    it('lets a player read their own history and nobody else’s', async () => {
      const other = await createUser(db);
      const mine = await addGame();
      const theirs = await addGame({ name: 'Celeste' }, other);
      await change(mine, { status: 'wont_play' });
      await change(theirs, { status: 'hidden' }, { userId: other });

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

    it('cannot be run by hand: its functions belong to the triggers', async () => {
      const rows = await db.query<{ fn: string; role: string; allowed: boolean }>(
        `select fn, role, has_function_privilege(role, fn, 'execute') as allowed
         from unnest(array['anon', 'authenticated']) as role,
              unnest(array[
                'public.record_game_event()',
                'public.record_games_added()',
                'public.game_event_snapshot(public.games)',
                'public.game_event_changes(jsonb, jsonb)',
                'public.game_event_net(jsonb, jsonb)',
                'public.game_event_kind(jsonb)',
                'public.game_event_arrival(jsonb)',
                'public.game_event_record(uuid, bigint, jsonb)',
                'public.record_queue_event()'
              ]) as fn`,
      );
      expect(rows).toHaveLength(18);
      expect(rows.filter((row) => row.allowed)).toEqual([]);
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

    it('keeps the history of a Steam game moved to a console when Steam is disconnected', async () => {
      const onConsole = await addGame({
        source: 'steam',
        app_id: 10,
        platform: 'Switch',
        name: 'Hades',
      });
      const onSteam = await addGame({
        source: 'steam',
        app_id: 11,
        platform: 'PC',
        name: 'Celeste',
      });
      await change(onConsole, { status: 'wont_play' });
      await change(onSteam, { status: 'wont_play' });
      await later();

      // clearLibrary: console games become games added by hand, the rest go.
      await db.asUser(
        player,
        `update games set source = 'manual', app_id = null
         where user_id = $1 and source = 'steam' and platform is not null and platform <> 'PC'`,
        [player],
      );
      await db.asUser(player, `delete from games where user_id = $1 and source = 'steam'`, [
        player,
      ]);

      expect(await eventsOf(onConsole)).toHaveLength(1);
      expect(await eventsOf(onSteam)).toEqual([]);
    });

    it('takes all of it with a deleted account', async () => {
      const [game] = await arrive([{ name: 'Hades' }]);
      await change(game, { status: 'wont_play' });
      await db.query('delete from auth.users where id = $1', [player]);
      expect(await countEvents()).toBe(0);
    });
  });

  describe('when recording fails', () => {
    it('still saves the game, and the change, when the history refuses the row', async () => {
      await db.exec('alter table game_events add constraint refuse_all check (false) not valid');
      let game: number;
      try {
        [game] = await arrive([{ name: 'Donkey Kong Bananza' }]);
        await change(game, { status: 'playing', started_at: '2026-11-17T10:00:00Z' });
        await write(game, 'playtime_forever = 30');
      } finally {
        await db.exec('alter table game_events drop constraint refuse_all');
      }

      expect(await statusOf(game)).toBe('playing');
      expect(await countEvents()).toBe(0);
    });

    it.each([
      'game_event_snapshot(public.games)',
      'game_event_changes(jsonb, jsonb)',
      'game_event_net(jsonb, jsonb)',
      'game_event_kind(jsonb)',
      'game_event_arrival(jsonb)',
    ])('still saves when a function it relies on is gone: %s', async (signature) => {
      const name = signature.slice(0, signature.indexOf('('));
      const existing = await addGame({ name: 'Existing', igdb_id: 9 });
      await change(existing, { status: 'wont_play' });

      await db.exec(`alter function public.${signature} rename to ${name}_gone`);
      let game: number;
      try {
        [game] = await arrive([{ name: 'Donkey Kong Bananza' }]);
        await change(game, { status: 'playing', started_at: '2026-11-17T10:00:00Z' });
        await change(existing, { status: 'backlog' });
        await write(game, 'playtime_forever = 30');
      } finally {
        await db.exec(
          `alter function public.${name}_gone${signature.slice(name.length)} rename to ${name}`,
        );
      }

      expect(await statusOf(game)).toBe('playing');
      expect(await statusOf(existing)).toBe('backlog');
    });
  });
});

describe('the migrations', () => {
  let db: TestDatabase;
  let player: string;

  const addGame = async (name: string) =>
    (
      await db.query<{ id: number }>(
        `insert into games (user_id, source, name) values ($1, 'manual', $2) returning id`,
        [player, name],
      )
    )[0].id;
  const kinds = async (game: number) =>
    (
      await db.query<{ kind: string }>(
        'select kind from game_events where game_id = $1 order by id',
        [game],
      )
    ).map((event) => event.kind);
  const move = (game: number, status: string) =>
    db.asUser(player, 'select apply_status_change($1::jsonb)', [
      JSON.stringify([{ id: game, update: { status } }]),
    ]);

  beforeAll(async () => {
    db = await createDatabase();
  }, 60_000);
  afterAll(() => db?.close());
  beforeEach(async () => {
    await clearDatabase(db);
    player = await createUser(db);
    await db.exec(UNINSTALL);
  });

  it('keep the history there is, each one applied on top of the last', async () => {
    await db.exec(MIGRATIONS[0]);
    // As the first alone left it: a change is recorded, an arrival is not.
    const first = await addGame('Hades');
    await move(first, 'wont_play');
    expect(await kinds(first)).toEqual(['status']);

    await db.exec(MIGRATIONS[1]);
    const second = await addGame('Celeste');
    expect(await kinds(second)).toEqual(['added']);

    await db.exec(MIGRATIONS[2]);
    expect(await kinds(first)).toEqual(['status']);
    expect(await kinds(second)).toEqual(['added']);
    // Events from before the last one count as their own sitting's.
    await db.exec(`update game_events
      set created_at = created_at - interval '1 minute', updated_at = updated_at - interval '1 minute'`);
    await move(first, 'backlog');
    expect(await kinds(first)).toEqual(['status', 'status']);

    // The fourth: the queue joins in, and what is there stays.
    await db.exec(MIGRATIONS[3]);
    expect(await kinds(first)).toEqual(['status', 'status']);
    await db.exec(`update game_events
      set created_at = created_at - interval '1 minute', updated_at = updated_at - interval '1 minute'`);
    await db.asUser(
      player,
      'insert into playing_queue (user_id, game_id, position) values ($1, $2, 0)',
      [player, first],
    );
    expect(await kinds(first)).toEqual(['status', 'status', 'queue']);
  });

  it('can each be applied again without harm', async () => {
    for (const migration of MIGRATIONS) await db.exec(migration);
    for (const migration of MIGRATIONS) await db.exec(migration);
    await db.exec(MIGRATIONS[2]);
    await db.exec(MIGRATIONS[3]);

    const game = await addGame('Hades');
    await db.exec(`update game_events
      set created_at = created_at - interval '1 minute', updated_at = updated_at - interval '1 minute'`);
    await move(game, 'wont_play');
    // One row per sitting: each trigger is there once.
    expect(await kinds(game)).toEqual(['added', 'status']);
  });
});
