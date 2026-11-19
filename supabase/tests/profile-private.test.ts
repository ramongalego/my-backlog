/**
 * @jest-environment node
 */
import { createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// A profile is public until its player makes it private. Checked on a database
// built from schema.sql and on one brought up by the migration (run twice, as
// it may be).

const MIGRATION = sqlFile('migrations', '20261119_profile_private.sql');

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
      await db.exec('alter table profiles drop column is_private');
      const earlier = await createUser(db);
      await db.exec(MIGRATION);
      await db.exec(MIGRATION);
      return { db, earlier };
    },
  ],
];

describe.each(BUILDS)('a private profile, on a database %s', (_, build) => {
  let db: TestDatabase;
  let earlier: string | null;

  const isPrivate = async (userId: string) => {
    const [row] = await db.query<{ is_private: boolean }>(
      'select is_private from profiles where id = $1',
      [userId],
    );
    return row.is_private;
  };

  beforeAll(async () => {
    ({ db, earlier } = await build());
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it('is not what a profile starts as: new and existing ones are public', async () => {
    if (earlier) expect(await isPrivate(earlier)).toBe(false);
    expect(await isPrivate(await createUser(db))).toBe(false);
  });

  it('is always a yes or a no', async () => {
    const player = await createUser(db);
    await expect(
      db.query('update profiles set is_private = null where id = $1', [player]),
    ).rejects.toThrow(/null value/);
  });

  it('is set by the server only, and read by its own player only', async () => {
    const player = await createUser(db);
    const other = await createUser(db);
    await expect(
      db.asUser(player, 'update profiles set is_private = true where id = $1', [player]),
    ).rejects.toThrow(/permission denied/);
    expect(await isPrivate(player)).toBe(false);

    await db.asServer('update profiles set is_private = true where id = $1', [player]);
    expect(await isPrivate(player)).toBe(true);
    expect(await isPrivate(other)).toBe(false);

    expect(await db.asUser(player, 'select is_private from profiles')).toEqual([
      { is_private: true },
    ]);
    expect(
      await db.asUser(other, 'select is_private from profiles where id = $1', [player]),
    ).toEqual([]);
    expect(await db.asVisitor('select is_private from profiles')).toEqual([]);
  });

  it('stays as the player left it when the migration is applied again', async () => {
    const player = await createUser(db);
    await db.asServer('update profiles set is_private = true where id = $1', [player]);
    await db.exec(MIGRATION);
    expect(await isPrivate(player)).toBe(true);
  });
});
