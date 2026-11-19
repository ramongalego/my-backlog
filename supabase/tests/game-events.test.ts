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

/** Changes within a minute of each other are one sitting: the function alone. */
const ONE_MINUTE = sqlFile('migrations', '20261119_history_one_minute.sql');

const MIGRATIONS = [
  '20261117_game_events.sql',
  '20261117_game_events_added.sql',
  '20261117_game_events_merged.sql',
  '20261117_game_events_queue.sql',
  '20261117_history_fixes.sql',
].map((file) => sqlFile('migrations', file));

/** Takes the history out of a database, as it was before the first migration. */
const UNINSTALL = `
  drop trigger if exists games_record_added on games;
  drop trigger if exists games_record_changed on games;
  drop trigger if exists playing_queue_record_added on playing_queue;
  drop trigger if exists playing_queue_record_removed on playing_queue;
  drop trigger if exists favorite_games_record_added on favorite_games;
  drop trigger if exists favorite_games_record_removed on favorite_games;
  drop function if exists public.record_favorite_event();
  drop function if exists public.game_event_failed(text, uuid, bigint, text);
  drop function if exists public.add_to_queue(bigint, numeric);
  drop table if exists game_event_failures;
  grant update on playing_queue to authenticated;
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
   * apply_status_change, in one transaction. `undo` sends them as an Undo of
   * a change made that many seconds ago (`true`: up to fifteen minutes ago).
   */
  const changeAll = (
    items: { id: number; update: Record<string, unknown> }[],
    {
      undo = false as boolean | number,
      userId = player,
      timeZone = undefined as string | undefined,
      /** Games put at the top of the queue in the same save: one paused for another. */
      toQueue = [] as number[],
    } = {},
  ) =>
    db.asUser(
      userId,
      'select apply_status_change($1::jsonb, $2::bigint[])',
      [
        JSON.stringify(
          items.map((item) =>
            undo === false ? item : { ...item, undo: true, ago: undo === true ? 900 : undo },
          ),
        ),
        toQueue,
      ],
      timeZone,
    );
  const change = (
    id: number,
    update: Record<string, unknown>,
    options: {
      undo?: boolean | number;
      userId?: string;
      timeZone?: string;
      toQueue?: number[];
    } = {},
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

  /** Time passes: every event so far is this much older. 61 seconds ends a sitting. */
  const later = (seconds = 61) =>
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

      it('records up to fifty arriving, and takes more than that for an import', async () => {
        await arrive(steamGames(5));
        await libraryIsOlder(30);

        await arrive(steamGames(50, 100));
        expect(await countEvents()).toBe(50);

        await libraryIsOlder(30);
        await arrive(steamGames(51, 200));
        expect(await countEvents()).toBe(50);
      });

      it('counts a sync as a whole: the last statement of a big one is not taken for purchases', async () => {
        await arrive(steamGames(5));
        await libraryIsOlder(30);

        // 510 new games come in two statements, as the sync sends them.
        await arrive(steamGames(500, 1000));
        await arrive(steamGames(10, 2000));
        expect(await countEvents()).toBe(0);
      });

      it('takes two small syncs minutes apart for purchases, both of them', async () => {
        await arrive(steamGames(5));
        await libraryIsOlder(30);

        await arrive(steamGames(3, 100));
        await libraryIsOlder(4);
        await arrive(steamGames(4, 200));
        expect(await countEvents()).toBe(7);
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
        `name = 'Hades II', main_story_hours = 22, reroll_count = 3,
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

    it('lasts as long as changes keep coming within a minute of each other', async () => {
      const game = await addGame({ playtime_forever: 0 });
      await write(game, 'playtime_forever = 10');
      await later(20);
      await write(game, 'playtime_forever = 20');
      await later(20);
      await write(game, 'playtime_forever = 30');
      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [0, 30] } },
      ]);

      // Under a minute since the last one: the same sitting still.
      await later(45);
      await write(game, 'playtime_forever = 40');
      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [0, 40] } },
      ]);

      await later(61);
      await write(game, 'playtime_forever = 50');
      expect((await eventsOf(game)).map((event) => event.changes.playtime_forever)).toEqual([
        [0, 40],
        [40, 50],
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

    it('stays a minute long once the one-minute migration is applied, twice', async () => {
      await db.exec(ONE_MINUTE);
      await db.exec(ONE_MINUTE);
      const game = await addGame({ playtime_forever: 0 });
      await write(game, 'playtime_forever = 10');
      await later(45);
      await write(game, 'playtime_forever = 20');
      await later(61);
      await write(game, 'playtime_forever = 30');
      expect((await eventsOf(game)).map((event) => event.changes.playtime_forever)).toEqual([
        [0, 20],
        [20, 30],
      ]);
    });

    it('leaves no trace of a game started and moved back to the backlog within a minute', async () => {
      const game = await addGame({});
      await change(game, { status: 'playing', started_at: '2026-11-19T20:00:00Z' });
      await later(45);
      await change(game, { status: 'backlog', started_at: null });

      expect(await countEvents()).toBe(0);
      expect(await statusOf(game)).toBe('backlog');

      // Past the minute it was played and put away: both are kept.
      await change(game, { status: 'playing', started_at: '2026-11-19T20:05:00Z' });
      await later(61);
      await change(game, { status: 'backlog', started_at: null });
      expect(await countEvents()).toBe(2);
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

  describe('an Undo whose change left no event', () => {
    const started = {
      kind: 'status',
      changes: { status: ['backlog', 'playing'], started_at: [null, '2026-11-17T20:00:00+00:00'] },
    };
    /** Started, moved back by hand within the sitting (which leaves nothing), then put back by Undo. */
    const startBackUndo = async (game: number) => {
      await change(game, { status: 'playing', started_at: '2026-11-17T20:00:00Z' });
      await later(10);
      await change(game, { status: 'backlog', started_at: null });
      await later(3);
      await change(game, { status: 'playing', started_at: '2026-11-17T20:00:00Z' }, { undo: 3 });
    };

    it("is a change of its own: it doesn't reach into the game's arrival", async () => {
      const [game] = await arrive([{ platform: 'Switch 2' }]);
      await later(90 * 24 * 3600);
      const arrival = await eventsOf(game);

      await startBackUndo(game);

      expect(await eventsOf(game)).toEqual([...arrival, started]);
    });

    it("doesn't turn hours played long ago into a start", async () => {
      const game = await addGame({ platform: 'PC', playtime_forever: 100 });
      await write(game, 'playtime_forever = 160');
      await later(200 * 24 * 3600);

      await startBackUndo(game);

      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [100, 160] } },
        started,
      ]);
    });

    it("doesn't take a week-old queue entry for the one it puts back", async () => {
      const game = await addGame();
      await queue(game);
      await later(7 * 24 * 3600);

      // Play, then "move to queue" within the sitting, then that move's Undo.
      await change(game, { status: 'playing', started_at: '2026-11-17T20:00:00Z' });
      await later(10);
      await change(game, { status: 'backlog' }, { toQueue: [game] });
      await later(3);
      await change(game, { status: 'playing' }, { undo: 3 });

      expect(await eventsOf(game)).toEqual([
        { kind: 'queue', changes: { queued: [false, true] } },
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

    it("doesn't take back a finish from months ago", async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-03-01T00:00:00Z' });
      const finished = { status: 'finished', finished_at: '2026-03-20T00:00:00Z', rating: 9 };
      await change(game, finished);
      await later(240 * 24 * 3600);
      const finish = await eventsOf(game);

      // Hidden and back within the sitting, then the Undo of the move back.
      const hidden = { status: 'hidden', finished_at: null, rating: null };
      await change(game, hidden);
      await later(10);
      await change(game, finished);
      await later(3);
      await change(game, hidden, { undo: 3 });

      expect(await eventsOf(game)).toEqual([
        ...finish,
        {
          kind: 'status',
          changes: {
            status: ['finished', 'hidden'],
            finished_at: ['2026-03-20T00:00:00+00:00', null],
            rating: [9, null],
          },
        },
      ]);
    });

    it("leaves another game's start alone when the Undo sends it back to the backlog", async () => {
      const other = await addGame({ name: 'Celeste', igdb_id: 2 });
      const game = await addGame({ name: 'Hades', igdb_id: 3 });
      // Started on another device an hour ago.
      await change(other, { status: 'playing', started_at: '2026-11-17T19:00:00Z' });
      await later(3600);

      // An Undo that starts a game again sends back whatever is playing.
      await changeAll(
        [
          { id: other, update: { status: 'backlog', started_at: null } },
          { id: game, update: { status: 'playing', started_at: '2026-11-17T20:00:00Z' } },
        ],
        { undo: 5 },
      );

      expect((await eventsOf(other)).map((event) => event.changes.status)).toEqual([
        ['backlog', 'playing'],
        ['playing', 'backlog'],
      ]);
    });

    it('only reaches the sitting when the app does not say how long ago the change was', async () => {
      const game = await addGame({ status: 'finished', finished_at: '2026-10-19T00:00:00Z' });
      await change(game, { status: 'hidden', finished_at: null });
      await later(600);
      await db.asUser(player, 'select apply_status_change($1::jsonb)', [
        JSON.stringify([
          {
            id: game,
            update: { status: 'finished', finished_at: '2026-10-19T00:00:00Z' },
            undo: true,
          },
        ]),
      ]);
      expect(await eventsOf(game)).toHaveLength(2);
    });

    it.each(['-5', 'soon', '1e9', '', '99999999999'])(
      'saves the change, and folds no further than it should, when how long ago is "%s"',
      async (ago) => {
        const game = await addGame();
        await change(game, { status: 'hidden' });
        await later(2 * 24 * 3600);
        await db.asUser(player, 'select apply_status_change($1::jsonb)', [
          JSON.stringify([{ id: game, update: { status: 'backlog' }, undo: true, ago }]),
        ]);
        expect(await statusOf(game)).toBe('backlog');
        // Two days is past the day an Undo can reach back.
        expect(await eventsOf(game)).toHaveLength(2);
      },
    );
  });

  describe('an Undo after something else happened to the game', () => {
    it('is taken out of the change it undoes, leaving what came in between', async () => {
      const game = await addGame({
        platform: 'PC',
        playtime_forever: 100,
        status: 'playing',
        started_at: '2026-11-01T00:00:00Z',
      });
      await change(game, { status: 'finished', finished_at: '2026-11-17T00:00:00Z', rating: 9 });
      await later(60);
      // The tab comes back: a refresh brings new hours before Undo is pressed.
      await write(game, 'playtime_forever = 130');
      await later(60);
      await change(game, { status: 'playing', finished_at: null, rating: null }, { undo: 120 });

      // Not a finish and then an un-finish: only the hours.
      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [100, 130] } },
      ]);
    });

    it('goes into the last event when a later change stands on what it takes back', async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-11-01T00:00:00Z' });
      await change(game, { status: 'finished', finished_at: '2026-11-17T00:00:00Z', rating: 9 });
      await later(60);
      await write(game, 'rating = 8');
      await later(60);
      await change(game, { status: 'playing', finished_at: null, rating: null }, { undo: 120 });

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'status',
          changes: {
            status: ['playing', 'finished'],
            finished_at: [null, '2026-11-17T00:00:00+00:00'],
            rating: [null, 9],
          },
        },
        {
          kind: 'status',
          changes: {
            status: ['finished', 'playing'],
            finished_at: ['2026-11-17T00:00:00+00:00', null],
            rating: [9, null],
          },
        },
      ]);
    });

    it('leaves only the hours when a switch to a queued game is undone after it was played', async () => {
      const a = await addGame({ status: 'playing', started_at: '2026-11-13T13:57:00Z' });
      const b = await addGame({ name: 'Celeste', igdb_id: 2, platform: 'PC' });
      await queue(b);
      await later(3600);
      const before = { a: await eventsOf(a), b: await eventsOf(b) };

      await changeAll(
        [
          { id: a, update: { status: 'backlog' } },
          { id: b, update: { status: 'playing', started_at: '2026-11-17T20:00:00Z' } },
        ],
        { toQueue: [a] },
      );
      await later(60);
      await write(b, 'playtime_forever = 90');
      await later(60);

      // Undo, as the app sends it: A is switched back to, pausing B at the top
      // of the queue, then B's start is cleared.
      await changeAll(
        [
          { id: b, update: { status: 'backlog' } },
          { id: a, update: { status: 'playing' } },
        ],
        { undo: 120, toQueue: [b] },
      );
      await change(b, { status: 'backlog', started_at: null }, { undo: 120 });

      expect(await queued()).toEqual([b]);
      expect(await eventsOf(a)).toEqual(before.a);
      expect(await eventsOf(b)).toEqual([
        ...before.b,
        { kind: 'playtime', changes: { playtime_forever: [0, 90] } },
      ]);
    });

    it('takes a game off the queue and puts it back by Undo, however late, leaving nothing', async () => {
      const game = await addGame();
      await queue(game);
      await later(3600);
      const before = await eventsOf(game);

      await unqueue(game);
      await later(600);
      await db.asUser(player, 'select add_to_queue($1, $2)', [game, 600]);

      expect(await queued()).toEqual([game]);
      expect(await eventsOf(game)).toEqual(before);
    });

    it("puts a game on the queue by Undo only if it is the player's, and once", async () => {
      const other = await createUser(db);
      const theirs = await addGame({}, other);
      await expect(db.asUser(player, 'select add_to_queue($1, $2)', [theirs, 5])).rejects.toThrow(
        /foreign key|violates/,
      );

      const game = await addGame();
      await db.asUser(player, 'select add_to_queue($1, $2)', [game, 5]);
      await db.asUser(player, 'select add_to_queue($1, $2)', [game, 5]);
      expect(await queued()).toEqual([game]);
      await expect(db.asVisitor('select add_to_queue($1, $2)', [game, 5])).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  describe('hours across a platform move', () => {
    const steamGame = () =>
      addGame({ source: 'steam', app_id: 620, platform: 'PC', playtime_forever: 3000 });

    it("doesn't fold a move into hours just played, which would lose them", async () => {
      const game = await steamGame();
      // A sync brings an hour played; seconds later the game is moved to a console.
      await write(game, 'playtime_forever = 3060');
      await write(game, `platform = 'Xbox', playtime_forever = 300`);

      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [3000, 3060] } },
        { kind: 'edit', changes: { platform: ['PC', 'Xbox'], playtime_forever: [3060, 300] } },
      ]);
    });

    it('still folds what is saved with the move into it', async () => {
      const game = await steamGame();
      await write(game, `platform = 'Xbox', playtime_forever = 300`);
      await change(game, { status: 'finished', finished_at: '2026-11-17T00:00:00Z' });
      await write(game, 'playtime_forever = 320');

      expect(await eventsOf(game)).toEqual([
        {
          kind: 'status',
          changes: {
            platform: ['PC', 'Xbox'],
            playtime_forever: [3000, 320],
            status: ['backlog', 'finished'],
            finished_at: [null, '2026-11-17T00:00:00+00:00'],
          },
        },
      ]);
    });

    it('is the hours as they end when a game is moved and moved back in one sitting', async () => {
      const game = await steamGame();
      await write(game, `platform = 'Xbox', playtime_forever = 300`);
      // Back to Steam, with the total Steam reports now.
      await write(game, `platform = 'PC', playtime_forever = 3050`);

      expect(await eventsOf(game)).toEqual([
        { kind: 'playtime', changes: { playtime_forever: [3000, 3050] } },
      ]);
    });

    it('folds a move into the arrival of a game that has only just arrived', async () => {
      const [game] = await arrive([{ platform: 'Switch', playtime_forever: 120 }]);
      await write(game, `platform = 'Switch 2'`);
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'added',
          changes: {
            status: [null, 'backlog'],
            platform: [null, 'Switch 2'],
            playtime_forever: [null, 120],
          },
        },
      ]);
    });
  });

  describe('favorites and notes', () => {
    const favorites = (ids: number[]) =>
      db.asUser(player, 'select set_favorite_games($1::bigint[])', [ids]);
    const favorite = { kind: 'favorite', changes: { favorite: [false, true] } };

    it('records a game becoming a favorite, and later no longer one', async () => {
      const game = await addGame();
      await favorites([game]);
      expect(await eventsOf(game)).toEqual([favorite]);

      await later();
      await favorites([]);
      expect(await eventsOf(game)).toEqual([
        favorite,
        { kind: 'favorite', changes: { favorite: [true, false] } },
      ]);
    });

    it('records nothing for the favorites that stay when they are saved again or reordered', async () => {
      const games = [await addGame({ igdb_id: 1 }), await addGame({ igdb_id: 2 })];
      await favorites(games);
      await later(3600);

      await favorites([games[1], games[0]]);
      const added = await addGame({ igdb_id: 3 });
      await later(3600);
      await favorites([games[1], games[0], added]);

      expect(await eventsOf(games[0])).toEqual([favorite]);
      expect(await eventsOf(games[1])).toEqual([favorite]);
      expect(await eventsOf(added)).toEqual([favorite]);
    });

    it("doesn't record a favorite being removed from the library as no longer a favorite", async () => {
      const kept = await addGame({ igdb_id: 1 });
      const removed = await addGame({ igdb_id: 2 });
      await favorites([kept, removed]);
      await later();

      await db.asUser(player, 'delete from games where id = $1', [removed]);

      expect(await eventsOf(removed)).toEqual([]);
      expect(await eventsOf(kept)).toEqual([favorite]);
    });

    it('records a note being written and cleared, never its words', async () => {
      const game = await addGame();
      await write(game, `notes = 'The ending got me'`);
      const written = { kind: 'note', changes: { noted: [false, true] } };
      expect(await eventsOf(game)).toEqual([written]);

      await later();
      await write(game, `notes = 'The ending really got me'`);
      expect(await eventsOf(game)).toEqual([written]);

      await later();
      await write(game, `notes = ''`);
      expect(await eventsOf(game)).toEqual([
        written,
        { kind: 'note', changes: { noted: [true, false] } },
      ]);
      expect(JSON.stringify(await db.query('select changes from game_events'))).not.toContain(
        'ending',
      );
    });

    it('carries the note with the finish it was written with', async () => {
      const game = await addGame({ status: 'playing', started_at: '2026-11-01T00:00:00Z' });
      await change(game, {
        status: 'finished',
        finished_at: '2026-11-17T00:00:00Z',
        rating: 9,
        notes: 'Loved it',
      });
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'status',
          changes: {
            status: ['playing', 'finished'],
            finished_at: [null, '2026-11-17T00:00:00+00:00'],
            rating: [null, 9],
            noted: [false, true],
          },
        },
      ]);
    });

    it('is part of the arrival of a game added with a note and made a favorite', async () => {
      const [game] = await arrive([{ platform: 'Switch', notes: 'From the eShop sale' }]);
      await favorites([game]);
      expect(await eventsOf(game)).toEqual([
        {
          kind: 'added',
          changes: {
            status: [null, 'backlog'],
            platform: [null, 'Switch'],
            noted: [null, true],
            favorite: [null, true],
          },
        },
      ]);
    });
  });

  describe('what could not be recorded', () => {
    const failures = () =>
      db.query<{ source: string; game_id: number | null; message: string }>(
        'select source, game_id, message from game_event_failures order by id',
      );

    it('is noted, with the game and what went wrong, while the change is still saved', async () => {
      const game = await addGame();
      await db.exec(
        'alter function public.game_event_record(uuid, bigint, jsonb) rename to game_event_record_gone',
      );
      try {
        await change(game, { status: 'hidden' });
        await queue(await addGame({ igdb_id: 2 }));
      } finally {
        await db.exec(
          'alter function public.game_event_record_gone(uuid, bigint, jsonb) rename to game_event_record',
        );
      }

      expect(await statusOf(game)).toBe('hidden');
      expect(await countEvents()).toBe(0);
      const noted = await failures();
      expect(noted.map((failure) => failure.source)).toEqual([
        'record_game_event',
        'record_queue_event',
      ]);
      expect(noted[0].game_id).toBe(game);
      expect(noted[0].message).toMatch(/game_event_record/);
    });

    it('is empty while everything is recorded', async () => {
      const game = await addGame();
      await change(game, { status: 'playing', started_at: '2026-11-17T20:00:00Z' });
      await queue(await addGame({ igdb_id: 2 }));
      expect(await failures()).toEqual([]);
    });

    it("can't be read or written by a player, and goes with a deleted account", async () => {
      await db.query(
        `insert into game_event_failures (source, user_id, message) values ('test', $1, 'x')`,
        [player],
      );
      await expect(db.asUser(player, 'select * from game_event_failures')).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.asUser(player, `insert into game_event_failures (source, message) values ('x', 'x')`),
      ).rejects.toThrow(/permission denied/);
      expect(await db.asServer('select source from game_event_failures')).toEqual([
        { source: 'test' },
      ]);

      await db.query('delete from auth.users where id = $1', [player]);
      expect(await failures()).toEqual([]);
    });

    it('still saves the change when even the note of the failure cannot be written', async () => {
      const game = await addGame();
      await db.exec(
        `alter function public.game_event_record(uuid, bigint, jsonb) rename to game_event_record_gone;
         alter function public.game_event_failed(text, uuid, bigint, text) rename to game_event_failed_gone`,
      );
      try {
        await change(game, { status: 'hidden' });
      } finally {
        await db.exec(
          `alter function public.game_event_record_gone(uuid, bigint, jsonb) rename to game_event_record;
           alter function public.game_event_failed_gone(text, uuid, bigint, text) rename to game_event_failed`,
        );
      }
      expect(await statusOf(game)).toBe('hidden');
    });
  });

  describe('what a player can do to the queue and the history directly', () => {
    it('moves a queue entry up and down, but cannot point it at another game', async () => {
      const a = await addGame({ igdb_id: 1 });
      const b = await addGame({ igdb_id: 2 });
      await queue(a);

      await db.asUser(player, 'update playing_queue set position = 5 where game_id = $1', [a]);
      await expect(
        db.asUser(player, 'update playing_queue set game_id = $1 where game_id = $2', [b, a]),
      ).rejects.toThrow(/permission denied/);
      expect(await queued()).toEqual([a]);
    });

    it('has the grants the history needs from its own migration, whatever a project gives new tables', async () => {
      const game = await addGame();
      await change(game, { status: 'hidden' });
      await db.exec('revoke all on game_events from anon, authenticated, service_role');
      await expect(db.asUser(player, 'select kind from game_events')).rejects.toThrow(
        /permission denied/,
      );

      await db.exec(MIGRATIONS[MIGRATIONS.length - 1]);

      expect(await db.asUser(player, 'select kind from game_events')).toEqual([{ kind: 'status' }]);
      expect(await db.asServer('select kind from game_events')).toEqual([{ kind: 'status' }]);
      await expect(db.asUser(player, 'delete from game_events')).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.asVisitor('select kind from game_events')).rejects.toThrow(
        /permission denied/,
      );
    });

    it('is whole again after the last migration alone, whatever an older one put back', async () => {
      // An older migration run again by itself narrows what the history takes.
      await db.exec(MIGRATIONS[1]);
      await db.exec(MIGRATIONS[MIGRATIONS.length - 1]);

      const game = await addGame();
      await queue(game);
      await db.asUser(player, 'select set_favorite_games($1::bigint[])', [[game]]);
      await later();
      await change(game, { status: 'playing', started_at: '2026-11-17T20:00:00Z' });

      expect((await eventsOf(game)).map((event) => event.kind)).toEqual(['queue', 'status']);
      expect(await db.query('select * from game_event_failures')).toEqual([]);
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
          { id: undone, update: { status: 'backlog' }, undo: true, ago: 600 },
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
               'queued', exists (select 1 from playing_queue q where q.game_id = g.id),
               'favorite', exists (select 1 from favorite_games f where f.game_id = g.id)
             ) as row
             from games g where g.id = $1`,
            [game],
          )
        )[0].row;
      const before = await snapshot();

      // The same sequence every run (mulberry32: every bit of it varies, where
      // a generator that overflowed a double drew the same answer to every
      // yes-or-no question).
      let seed = 20261117;
      const random = (below: number) => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * below);
      };
      const drawn = { undone: 0, plain: 0, dated: 0 };
      let isFavorite = false;
      const day = () => `2026-${String(1 + random(11)).padStart(2, '0')}-1${random(9)}T00:00:00Z`;
      const statuses = ['backlog', 'playing', 'finished', 'dropped', 'wont_play', 'hidden'];

      const STEPS = 400;
      for (let step = 0; step < STEPS; step++) {
        const what = random(9);
        if (what === 0 || what === 7) {
          // An Undo of a change made a moment ago, a minute ago or an hour ago.
          const undo = random(3) === 0 ? [3, 70, 3600][random(3)] : false;
          if (undo === false) drawn.plain++;
          else drawn.undone++;
          await change(
            game,
            {
              status: statuses[random(statuses.length)],
              ...(random(2) ? { started_at: random(3) ? (drawn.dated++, day()) : null } : {}),
              ...(random(2) ? { finished_at: random(3) ? day() : null } : {}),
              ...(random(2) ? { dropped_at: random(3) ? day() : null } : {}),
              ...(random(2) ? { rating: random(4) ? random(11) : null } : {}),
              ...(random(3) === 0 ? { notes: random(2) ? 'A note' : null } : {}),
            },
            {
              undo,
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
          else if (random(3) === 0) {
            await db.asUser(player, 'select add_to_queue($1, $2)', [
              game,
              [3, 70, 3600][random(3)],
            ]);
          } else await queue(game);
        } else if (what === 8) {
          isFavorite = !isFavorite;
          await db.asUser(player, 'select set_favorite_games($1::bigint[])', [
            isFavorite ? [game] : [],
          ]);
        } else {
          await write(game, `last_played_at = '${day()}', name = 'Hades ${step}'`);
        }
        // Sometimes the next change is part of the same sitting, sometimes a
        // minute later, sometimes hours.
        const gap = random(4);
        if (gap === 1) await later(31);
        else if (gap === 2) await later(5000);
      }
      // The draws really varied: plain changes and Undos, with and without dates.
      expect(drawn.undone).toBeGreaterThan(15);
      expect(drawn.plain).toBeGreaterThan(30);
      expect(drawn.dated).toBeGreaterThan(15);

      const state: Record<string, unknown> = { ...before };
      const events = await eventsOf(game);
      for (const event of events) {
        expect(['status', 'edit', 'queue', 'favorite', 'note', 'playtime']).toContain(event.kind);
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
      expect(events.length).toBeLessThan(STEPS);
      expect(await db.query('select * from game_event_failures')).toEqual([]);
    }, 120_000);
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
                'public.record_queue_event()',
                'public.record_favorite_event()',
                'public.game_event_failed(text, uuid, bigint, text)'
              ]) as fn`,
      );
      expect(rows).toHaveLength(22);
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
