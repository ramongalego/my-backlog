/**
 * @jest-environment node
 */
import { clearDatabase, createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// What Pick My Game and Random came up with (game_picks), which only the
// app's server writes: its rules, and who can read and write it, run here
// against a real Postgres. Checked twice, on a database built from schema.sql
// and on one brought up by the migration, so the two can't drift apart.

const MIGRATION = sqlFile('migrations', '20261117_game_picks.sql');

const BUILDS: [string, () => Promise<TestDatabase>][] = [
  ['built from schema.sql', createDatabase],
  [
    'brought up by the migration',
    async () => {
      const db = await createDatabase();
      await db.exec('drop table if exists game_picks');
      await db.exec(MIGRATION);
      return db;
    },
  ],
];

describe.each(BUILDS)('the picks, on a database %s', (_, build) => {
  let db: TestDatabase;
  let player: string;
  let other: string;

  const addGame = async (userId: string = player, name = 'Hades'): Promise<number> => {
    const [game] = await db.query<{ id: number }>(
      `insert into games (user_id, source, name) values ($1, 'manual', $2) returning id`,
      [userId, name],
    );
    return game.id;
  };

  /** Records a pick as the server does, with its own key. */
  const record = async (pick: Record<string, unknown>): Promise<number> => {
    const names = Object.keys(pick);
    const [row] = await db.asServer<{ id: number }>(
      `insert into game_picks (${names.join(', ')})
       values (${names.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
      names.map((name) => pick[name]),
    );
    return row.id;
  };
  const fromQuestions = (game: number, more: Record<string, unknown> = {}) => ({
    user_id: player,
    game_id: game,
    kind: 'questions',
    mode: 'play',
    mood: 'relaxed',
    energy: 'low',
    time: 'short',
    reasoning: 'Short and gentle.',
    model: 'a-model',
    ...more,
  });
  const atRandom = (game: number, more: Record<string, unknown> = {}) => ({
    user_id: player,
    game_id: game,
    kind: 'random',
    mode: 'queue',
    ...more,
  });
  const picks = () => db.query('select * from game_picks order by id');
  const count = async () =>
    Number((await db.query<{ n: number }>('select count(*)::int as n from game_picks'))[0].n);

  beforeAll(async () => {
    db = await build();
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await clearDatabase(db);
    player = await createUser(db);
    other = await createUser(db);
  });

  describe('what a pick holds', () => {
    it('keeps a pick from the questions: the answers, the reason and which attempt it was', async () => {
      const game = await addGame();
      await record(fromQuestions(game, { attempt: 3, mode: 'queue' }));

      expect(await picks()).toEqual([
        expect.objectContaining({
          user_id: player,
          game_id: game,
          kind: 'questions',
          mode: 'queue',
          mood: 'relaxed',
          energy: 'low',
          time: 'short',
          attempt: 3,
          reasoning: 'Short and gentle.',
          model: 'a-model',
          outcome: null,
          answered_at: null,
          created_at: expect.anything(),
        }),
      ]);
    });

    it('keeps a random pick, which has no answers and no reason', async () => {
      const game = await addGame();
      await record(atRandom(game));
      expect(await picks()).toEqual([
        expect.objectContaining({
          kind: 'random',
          mode: 'queue',
          mood: null,
          energy: null,
          time: null,
          attempt: 1,
          reasoning: null,
          model: null,
          outcome: null,
        }),
      ]);
    });

    it('keeps what the player did with it, and when', async () => {
      const game = await addGame();
      const id = await record(fromQuestions(game));
      await db.asServer(
        `update game_picks set outcome = 'played', answered_at = now() where id = $1`,
        [id],
      );
      expect(await picks()).toEqual([
        expect.objectContaining({ outcome: 'played', answered_at: expect.anything() }),
      ]);
    });

    it.each(['played', 'queued', 'rerolled', 'unseen'])('takes the outcome %s', async (outcome) => {
      const game = await addGame();
      await record(fromQuestions(game, { outcome, answered_at: new Date() }));
      expect(await picks()).toEqual([expect.objectContaining({ outcome })]);
    });

    it('takes an answer the questions did not have when the table was made', async () => {
      const game = await addGame();
      await record(fromQuestions(game, { mood: 'curious' }));
      expect(await picks()).toEqual([expect.objectContaining({ mood: 'curious' })]);
    });

    it.each([
      ['a kind it does not know', { kind: 'guess' }],
      ['a mode it does not know', { mode: 'later' }],
      ['an outcome it does not know', { outcome: 'ignored', answered_at: new Date() }],
      ['an attempt before the first', { attempt: 0 }],
      ['a pick from the questions without a mood', { mood: null }],
      ['a pick from the questions without an energy', { energy: null }],
      ['a pick from the questions without a time', { time: null }],
      ['an outcome with no time it was chosen', { outcome: 'played' }],
      ['a time it was chosen with no outcome', { answered_at: new Date() }],
    ])('refuses %s', async (_, wrong) => {
      const game = await addGame();
      await expect(record(fromQuestions(game, wrong))).rejects.toThrow(/violates/);
      expect(await count()).toBe(0);
    });

    it.each([
      ['a mood', { mood: 'relaxed' }],
      ['an energy', { energy: 'low' }],
      ['a time', { time: 'short' }],
      ['a reason', { reasoning: 'Because.' }],
      ['a model', { model: 'a-model' }],
    ])('refuses a random pick with %s', async (_, wrong) => {
      const game = await addGame();
      await expect(record(atRandom(game, wrong))).rejects.toThrow(/game_picks_answers/);
      expect(await count()).toBe(0);
    });

    it("refuses a pick of a game that isn't the player's, or isn't there", async () => {
      const theirs = await addGame(other);
      await expect(record(atRandom(theirs))).rejects.toThrow(/foreign key/);
      await expect(record(atRandom(999_999))).rejects.toThrow(/foreign key/);
      expect(await count()).toBe(0);
    });
  });

  describe('who can read and write it', () => {
    it('lets a player read their own picks and nobody else’s', async () => {
      const mine = await addGame();
      const theirs = await addGame(other);
      await record(atRandom(mine));
      await record(atRandom(theirs, { user_id: other }));

      expect(await db.asUser(player, 'select game_id from game_picks')).toEqual([
        { game_id: mine },
      ]);
      expect(await db.asUser(other, 'select game_id from game_picks')).toEqual([
        { game_id: theirs },
      ]);
    });

    it('shows a signed-out visitor nothing', async () => {
      await record(atRandom(await addGame()));
      await expect(db.asVisitor('select * from game_picks')).rejects.toThrow(/permission denied/);
    });

    it.each([
      [
        'add a pick',
        `insert into game_picks (user_id, game_id, kind, mode) values ($1, $2, 'random', 'play')`,
      ],
      [
        'change a pick',
        `update game_picks set outcome = 'played', answered_at = now() where user_id = $1 and game_id = $2`,
      ],
      ['remove a pick', `delete from game_picks where user_id = $1 and game_id = $2`],
    ])("doesn't let a player %s, even their own", async (_, sql) => {
      const game = await addGame();
      await record(atRandom(game));
      const before = await picks();

      await expect(db.asUser(player, sql, [player, game])).rejects.toThrow(/permission denied/);
      await expect(db.asVisitor(sql, [player, game])).rejects.toThrow(/permission denied/);
      expect(await picks()).toEqual(before);
    });

    it("doesn't let a player empty the table", async () => {
      await record(atRandom(await addGame()));
      await expect(db.asUser(player, 'truncate game_picks')).rejects.toThrow(/permission denied/);
      expect(await count()).toBe(1);
    });

    it('has row-level security on, with the one policy: read your own', async () => {
      const [table] = await db.query<{ relrowsecurity: boolean }>(
        `select relrowsecurity from pg_class where oid = 'public.game_picks'::regclass`,
      );
      expect(table.relrowsecurity).toBe(true);
      expect(
        await db.query(
          `select policyname, cmd, roles::text[] as roles from pg_policies
           where schemaname = 'public' and tablename = 'game_picks'`,
        ),
      ).toEqual([
        { policyname: 'Users can view own game picks', cmd: 'SELECT', roles: ['authenticated'] },
      ]);
    });
  });

  describe('what goes with a game', () => {
    it('goes when the game is removed, leaving the other games’ picks', async () => {
      const kept = await addGame(player, 'Hades');
      const removed = await addGame(player, 'Celeste');
      await record(atRandom(kept));
      await record(fromQuestions(removed));
      await record(atRandom(removed));

      await db.asUser(player, 'delete from games where id = $1', [removed]);

      expect(await picks()).toEqual([expect.objectContaining({ game_id: kept })]);
    });

    it('goes with a deleted account, leaving the other players’ picks', async () => {
      await record(atRandom(await addGame()));
      const theirs = await addGame(other);
      await record(atRandom(theirs, { user_id: other }));

      await db.query('delete from auth.users where id = $1', [player]);

      expect(await picks()).toEqual([expect.objectContaining({ user_id: other })]);
    });

    it("doesn't touch the game, its history or its reroll count", async () => {
      const game = await addGame();
      const before = await db.query('select * from games where id = $1', [game]);
      const events = await db.query('select id, kind, changes from game_events order by id');

      const id = await record(fromQuestions(game));
      await db.asServer(
        `update game_picks set outcome = 'rerolled', answered_at = now() where id = $1`,
        [id],
      );

      expect(await db.query('select * from games where id = $1', [game])).toEqual(before);
      expect(await db.query('select id, kind, changes from game_events order by id')).toEqual(
        events,
      );
    });
  });

  describe('the migration', () => {
    it('grants what the app needs itself, on a project that grants new tables to nobody', async () => {
      const game = await addGame();
      await db.exec('revoke all on game_picks from anon, authenticated, service_role');
      await expect(record(atRandom(game))).rejects.toThrow(/permission denied/);
      await expect(db.asUser(player, 'select * from game_picks')).rejects.toThrow(
        /permission denied/,
      );

      await db.exec(MIGRATION);

      const id = await record(atRandom(game));
      await db.asServer(
        `update game_picks set outcome = 'queued', answered_at = now() where id = $1`,
        [id],
      );
      expect(await db.asServer('select outcome from game_picks')).toEqual([{ outcome: 'queued' }]);
      await db.asServer('delete from game_picks where id = $1', [id]);
      await record(atRandom(game));

      expect(await db.asUser(player, 'select game_id from game_picks')).toEqual([
        { game_id: game },
      ]);
      await expect(
        db.asUser(
          player,
          `insert into game_picks (user_id, game_id, kind, mode) values ($1, $2, 'random', 'play')`,
          [player, game],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(db.asVisitor('select * from game_picks')).rejects.toThrow(/permission denied/);
    });

    it('can be applied again, keeping the picks already there', async () => {
      const game = await addGame();
      await record(fromQuestions(game));
      const before = await picks();

      await db.exec(MIGRATION);

      expect(await picks()).toEqual(before);
      await expect(
        db.asUser(player, `delete from game_picks where game_id = $1`, [game]),
      ).rejects.toThrow(/permission denied/);
      expect(await db.asUser(player, 'select game_id from game_picks')).toEqual([
        { game_id: game },
      ]);
    });
  });
});
