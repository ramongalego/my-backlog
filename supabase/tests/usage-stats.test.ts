/**
 * @jest-environment node
 */
import { usageSchema, type Usage } from '@/lib/usage';
import { clearDatabase, createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// The owner's usage page counts players with usage_stats: who can call it,
// and what it counts. Checked on a database built from schema.sql and on one
// brought up by the migration (run twice, as it may be).

const MIGRATION = sqlFile('migrations', '20261118_usage_stats.sql');

const BUILDS: [string, () => Promise<TestDatabase>][] = [
  ['built from schema.sql', createDatabase],
  [
    'brought up by the migration',
    async () => {
      const db = await createDatabase();
      await db.exec('drop function public.usage_stats(uuid[])');
      await db.exec(MIGRATION);
      await db.exec(MIGRATION);
      return db;
    },
  ],
];

describe.each(BUILDS)('usage_stats, on a database %s', (_, build) => {
  let db: TestDatabase;

  const usage = async (exclude: string[] = []): Promise<Usage> => {
    const [row] = await db.asServer<{ usage: Usage }>(
      'select public.usage_stats($1::uuid[]) as usage',
      [exclude],
    );
    return row.usage;
  };
  const addGame = async (userId: string): Promise<number> => {
    const [game] = await db.query<{ id: number }>(
      `insert into games (user_id, source, name) values ($1, 'manual', 'Hades') returning id`,
      [userId],
    );
    return game.id;
  };

  beforeAll(async () => {
    db = await build();
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await clearDatabase(db);
  });

  it('can be called with the server key only, never by a player or a visitor', async () => {
    const player = await createUser(db);
    await expect(db.asUser(player, 'select public.usage_stats()')).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.asVisitor('select public.usage_stats()')).rejects.toThrow(/permission denied/);
    await expect(usage()).resolves.toMatchObject({ players: 1 });
  });

  it('answers in the shape the usage page reads', async () => {
    await createUser(db);
    expect(usageSchema.safeParse(await usage()).success).toBe(true);
  });

  it('counts players and what they did, and nothing that says who they are', async () => {
    const steam = await createUser(db);
    const quiet = await createUser(db);
    await db.query(`update profiles set steam_id = '7656' where id = $1`, [steam]);
    const game = await addGame(steam);
    await db.query(`update games set status = 'finished', finished_at = now() where id = $1`, [
      game,
    ]);
    await db.asServer(
      `insert into game_picks (user_id, game_id, kind, mode, outcome, answered_at)
       values ($1, $2, 'random', 'play', 'played', now()), ($1, $2, 'random', 'play', null, null)`,
      [steam, game],
    );

    const result = await usage();
    expect(result).toMatchObject({
      players: 2,
      steamConnected: 1,
      withGames: 1,
      activeDay: 1,
      activeWeek: 1,
      month: { picks: 2, picksTaken: 1, pickers: 1, finishes: 1, finishers: 1 },
    });
    expect(result.weeks).toHaveLength(8);
    expect(result.weeks[0]).toMatchObject({ signups: 2, active: 1, picks: 2, finishes: 1 });
    expect(JSON.stringify(result)).not.toContain(steam);
    expect(JSON.stringify(result)).not.toContain(quiet);
  });

  it('counts how players sign in, and email sign-ups never confirmed', async () => {
    const email = await createUser(db);
    const google = await createUser(db);
    const both = await createUser(db);
    await db.query(
      `insert into auth.identities (user_id, provider)
       values ($1, 'email'), ($2, 'google'), ($3, 'email'), ($3, 'discord')`,
      [email, google, both],
    );
    await db.query('update auth.users set email_confirmed_at = now() where id <> $1', [email]);
    expect((await usage()).signups).toEqual({ email: 2, google: 1, discord: 1, unconfirmed: 1 });
  });

  it('sizes libraries without hidden games or what Steam lists that is not a game', async () => {
    const steam = await createUser(db);
    const manual = await createUser(db);
    await db.query(
      `insert into games (user_id, source, app_id, name, status, type) values
         ($1, 'steam', 1, 'A', 'backlog', 'game'), ($1, 'steam', 2, 'B', 'finished', 'game'),
         ($1, 'steam', 3, 'C', 'hidden', 'game'), ($1, 'steam', 4, 'Tool', 'backlog', 'tool'),
         ($2, 'manual', null, 'D', 'backlog', null)`,
      [steam, manual],
    );
    expect((await usage()).libraries).toEqual({
      medianGames: 2,
      steamGames: 2,
      manualGames: 1,
      manualOnly: 1,
    });
  });

  it('counts the players who have used each feature', async () => {
    const player = await createUser(db);
    await createUser(db);
    const game = await addGame(player);
    await db.query(`update games set rating = 8, notes = 'Good', art_chosen = true where id = $1`, [
      game,
    ]);
    await db.query('insert into playing_queue (user_id, game_id) values ($1, $2)', [player, game]);
    await db.query('insert into favorite_games (user_id, game_id, position) values ($1, $2, 0)', [
      player,
      game,
    ]);
    await db.query(`update profiles set display_name = 'Sam' where id = $1`, [player]);
    await db.query(
      `insert into player_insights (user_id, tone, headline, paragraphs, signature)
       values ($1, 'roast', 'Hi', '[]', 's')`,
      [player],
    );
    expect((await usage()).features).toEqual({
      queue: 1,
      favorites: 1,
      notes: 1,
      ratings: 1,
      addedByHand: 1,
      chosenArt: 1,
      shareCards: 0,
      nameOrPicture: 1,
      profile: 0,
      roast: 1,
    });
  });

  it('says how picks went and the answers given most', async () => {
    const player = await createUser(db);
    const game = await addGame(player);
    const pick = (mood: string, outcome: string | null) =>
      db.asServer(
        `insert into game_picks (user_id, game_id, kind, mode, mood, energy, time, outcome, answered_at)
         values ($1, $2, 'questions', 'play', $3, 'low', 'short', $4::text,
                 case when $4::text is null then null else now() end)`,
        [player, game, mood, outcome],
      );
    await pick('relaxed', 'played');
    await pick('relaxed', 'rerolled');
    await pick('engaged', null);
    await db.asServer(
      `insert into game_picks (user_id, game_id, kind, mode, outcome, answered_at)
       values ($1, $2, 'random', 'queue', 'queued', now())`,
      [player, game],
    );

    expect((await usage()).pickMyGame).toEqual({
      questions: 3,
      random: 1,
      played: 1,
      queued: 1,
      rerolled: 1,
      closed: 1,
      moods: [
        { answer: 'relaxed', picks: 2 },
        { answer: 'engaged', picks: 1 },
      ],
      energies: [{ answer: 'low', picks: 3 }],
      times: [{ answer: 'short', picks: 3 }],
    });
  });

  it('counts a player who only opened the app, by their session', async () => {
    const player = await createUser(db);
    await db.query('insert into auth.sessions (user_id) values ($1)', [player]);
    expect(await usage()).toMatchObject({ activeDay: 1, activeMonth: 1 });
  });

  it('counts a player as back when they did something after their first day', async () => {
    const back = await createUser(db);
    const once = await createUser(db);
    await db.query(`update profiles set created_at = now() - interval '3 days'`);
    await db.query(
      `insert into auth.sessions (user_id, created_at, updated_at)
       values ($1, now() - interval '3 days', now()),
              ($2, now() - interval '3 days', now() - interval '3 days')`,
      [back, once],
    );
    expect(await usage()).toMatchObject({ cameBack: 1, activeDay: 1, activeWeek: 2 });
  });

  it('leaves the excluded accounts out of every count', async () => {
    const owner = await createUser(db);
    await createUser(db);
    const game = await addGame(owner);
    await db.asServer(
      `insert into game_picks (user_id, game_id, kind, mode) values ($1, $2, 'random', 'play')`,
      [owner, game],
    );

    expect(await usage([owner])).toMatchObject({
      players: 1,
      withGames: 0,
      activeMonth: 0,
      month: { picks: 0 },
      features: { addedByHand: 0 },
    });
  });
});
