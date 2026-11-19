/**
 * @jest-environment node
 */
import { createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// The AI features are on until a player turns them off. Checked on a database
// built from schema.sql and on one brought up by the migration (run twice, as
// it may be).

const MIGRATION = sqlFile('migrations', '20261119_ai_disabled.sql');

interface Built {
  db: TestDatabase;
  /** A profile from before the column, where there was a before. */
  earlier: string | null;
}

const BUILDS: [string, () => Promise<Built>][] = [
  ['built from schema.sql', async () => ({ db: await createDatabase(), earlier: null })],
  [
    'brought up by the migration',
    async () => {
      const db = await createDatabase();
      await db.exec('alter table profiles drop column ai_disabled');
      const earlier = await createUser(db);
      await db.exec(MIGRATION);
      await db.exec(MIGRATION);
      return { db, earlier };
    },
  ],
];

describe.each(BUILDS)('turning the AI features off, on a database %s', (_, build) => {
  let db: TestDatabase;
  let earlier: string | null;

  const isOff = async (userId: string) => {
    const [row] = await db.query<{ ai_disabled: boolean }>(
      'select ai_disabled from profiles where id = $1',
      [userId],
    );
    return row.ai_disabled;
  };

  beforeAll(async () => {
    ({ db, earlier } = await build());
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it('is not how a profile starts: new and existing ones have them on', async () => {
    if (earlier) expect(await isOff(earlier)).toBe(false);
    expect(await isOff(await createUser(db))).toBe(false);
  });

  it('is always a yes or a no', async () => {
    const player = await createUser(db);
    await expect(
      db.query('update profiles set ai_disabled = null where id = $1', [player]),
    ).rejects.toThrow(/null value/);
  });

  it('is set by the server only, and read by its own player (as the routes do)', async () => {
    const player = await createUser(db);
    const other = await createUser(db);
    await expect(
      db.asUser(player, 'update profiles set ai_disabled = true where id = $1', [player]),
    ).rejects.toThrow(/permission denied/);
    expect(await isOff(player)).toBe(false);

    await db.asServer('update profiles set ai_disabled = true where id = $1', [player]);
    expect(await isOff(player)).toBe(true);
    expect(await isOff(other)).toBe(false);

    expect(await db.asUser(player, 'select ai_disabled from profiles')).toEqual([
      { ai_disabled: true },
    ]);
    expect(
      await db.asUser(other, 'select ai_disabled from profiles where id = $1', [player]),
    ).toEqual([]);
  });

  it('stays as the player left it when the migration is applied again', async () => {
    const player = await createUser(db);
    await db.asServer('update profiles set ai_disabled = true where id = $1', [player]);
    await db.exec(MIGRATION);
    expect(await isOff(player)).toBe(true);
  });
});
