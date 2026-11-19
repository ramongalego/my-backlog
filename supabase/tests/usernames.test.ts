/**
 * @jest-environment node
 */
import { clearDatabase, createDatabase, createUser, sqlFile, type TestDatabase } from './database';

// Every profile has a username: how one is given, picked and renamed, and who
// can do which. Checked on a database built from schema.sql and on one brought
// up by the migration (run twice, as it may be).

const MIGRATION = sqlFile('migrations', '20261119_usernames.sql');

/** A database from before usernames. */
async function createDatabaseWithoutUsernames(): Promise<TestDatabase> {
  const db = await createDatabase();
  await db.exec(`
    drop trigger profiles_give_username on profiles;
    drop function public.profiles_give_username();
    drop function public.claim_username(uuid, text);
    drop function public.rename_given_username(uuid, text);
    drop function public.free_username(text);
    drop function public.username_from(text);
    drop function public.set_display_name(uuid, text);
    drop function public.name_allowed(text);
    drop function public.username_offensive(text);
    drop function public.username_reserved(text);
    alter table profiles drop column username, drop column username_auto;
  `);
  return db;
}

const BUILDS: [string, () => Promise<TestDatabase>][] = [
  ['built from schema.sql', createDatabase],
  [
    'brought up by the migration',
    async () => {
      const db = await createDatabaseWithoutUsernames();
      await db.exec(MIGRATION);
      await db.exec(MIGRATION);
      return db;
    },
  ],
];

interface Named {
  username: string;
  username_auto: boolean;
}

describe.each(BUILDS)('usernames, on a database %s', (_, build) => {
  let db: TestDatabase;

  const profileOf = async (userId: string): Promise<Named> => {
    const [row] = await db.query<Named>(
      'select username, username_auto from profiles where id = $1',
      [userId],
    );
    return row;
  };
  /** An account whose profile was made with this name already on it. */
  const createNamed = async (name: { display?: string; steam?: string }): Promise<string> => {
    const userId = await createUser(db);
    await db.query('delete from profiles where id = $1', [userId]);
    await db.query('insert into profiles (id, display_name, steam_username) values ($1, $2, $3)', [
      userId,
      name.display ?? null,
      name.steam ?? null,
    ]);
    return userId;
  };
  const claim = async (userId: string, username: string | null): Promise<string> => {
    const [row] = await db.asServer<{ answer: string }>(
      'select public.claim_username($1, $2) as answer',
      [userId, username],
    );
    return row.answer;
  };
  const renameGiven = async (userId: string, name: string | null): Promise<string | null> => {
    const [row] = await db.asServer<{ renamed: string | null }>(
      'select public.rename_given_username($1, $2) as renamed',
      [userId, name],
    );
    return row.renamed;
  };
  const usernameFrom = async (name: string | null): Promise<string | null> => {
    const [row] = await db.query<{ username: string | null }>(
      'select public.username_from($1) as username',
      [name],
    );
    return row.username;
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

  it('gives a new account "player" and a number, never anything from its email', async () => {
    const [user] = await db.query<{ id: string }>(
      `insert into auth.users (email) values ('jane.doe@example.com') returning id`,
    );
    const profile = await profileOf(user.id);
    expect(profile.username).toMatch(/^player\d{4}$/);
    expect(profile.username_auto).toBe(true);
  });

  it('gives every account a username of its own', async () => {
    const ids = [];
    for (let i = 0; i < 25; i++) ids.push(await createUser(db));
    const names = await Promise.all(ids.map(async (id) => (await profileOf(id)).username));
    expect(new Set(names).size).toBe(25);
  });

  it('makes a username from a name: lowercase, without accents, spaces or symbols', async () => {
    expect(await usernameFrom('Mist Kai')).toBe('mistkai');
    expect(await usernameFrom('Ramón Añejo')).toBe('ramonanejo');
    expect(await usernameFrom(' -xX_Slayer_Xx- ')).toBe('xx_slayer_xx');
    expect(await usernameFrom('The Legend of a Very Long Name Indeed')).toBe(
      'thelegendofaverylong',
    );
  });

  it('makes none from a name that leaves too little, or a reserved word', async () => {
    expect(await usernameFrom('ミスト')).toBeNull();
    expect(await usernameFrom('ab')).toBeNull();
    expect(await usernameFrom('___')).toBeNull();
    expect(await usernameFrom('Admin')).toBeNull();
    expect(await usernameFrom('MyBacklog')).toBeNull();
    expect(await usernameFrom(null)).toBeNull();
  });

  it('names a profile made with a name after it: the chosen one, else the Steam one', async () => {
    expect(
      (await profileOf(await createNamed({ display: 'Mist Kai', steam: 'steamy' }))).username,
    ).toBe('mistkai');
    expect((await profileOf(await createNamed({ steam: 'Gordon Freeman' }))).username).toBe(
      'gordonfreeman',
    );
    // A chosen name that gives none falls back to the Steam one.
    expect(
      (await profileOf(await createNamed({ display: 'ミスト', steam: 'Alyx' }))).username,
    ).toBe('alyx');
  });

  it('adds a number to a name that is taken', async () => {
    await createNamed({ display: 'Mist Kai' });
    const second = await profileOf(await createNamed({ display: 'mistkai' }));
    expect(second.username).toMatch(/^mistkai\d{2}$/);
    // A name at the full length makes room for its number.
    await createNamed({ display: 'abcdefghijklmnopqrst' });
    const long = await profileOf(await createNamed({ display: 'abcdefghijklmnopqrst' }));
    expect(long.username).toMatch(/^abcdefghijklmnopqr\d{2}$/);
  });

  it('lets the player pick their own, which is theirs from then on', async () => {
    const player = await createUser(db);
    expect(await claim(player, 'mist_kai-7')).toBe('ok');
    expect(await profileOf(player)).toEqual({ username: 'mist_kai-7', username_auto: false });
  });

  it('refuses one somebody has, a reserved word, and anything that is not a username', async () => {
    const first = await createUser(db);
    const second = await createUser(db);
    const before = await profileOf(second);
    expect(await claim(first, 'mistkai')).toBe('ok');

    expect(await claim(second, 'mistkai')).toBe('taken');
    expect(await claim(second, 'admin')).toBe('reserved');
    expect(await claim(second, 'support')).toBe('reserved');
    for (const not of ['ab', 'MistKai', 'mist kai', 'mist.kai', '___', 'x'.repeat(21), '', null]) {
      expect(await claim(second, not)).toBe('invalid');
    }
    expect(await profileOf(second)).toEqual(before);
  });

  it('refuses a slur, however it is dressed: numbers for letters, - and _ between them', async () => {
    const player = await createUser(db);
    const before = await profileOf(player);
    for (const offensive of [
      'nigger',
      'n1gg3r',
      'xx_n-i-g-g-a_xx',
      'faggot99',
      'h1tler',
      'nazi',
      'nazi_88',
      'n4z1',
      'rape',
      'the-rapist',
      'pedo_bear',
    ]) {
      // The same answer as a reserved word: it isn't told apart.
      expect([offensive, await claim(player, offensive)]).toEqual([offensive, 'reserved']);
    }
    expect(await profileOf(player)).toEqual(before);
  });

  it('lets through the innocent names that only hold the same letters', async () => {
    const player = await createUser(db);
    for (const innocent of [
      'grape',
      'therapist',
      'torpedo',
      'raccoon',
      'spicy',
      'nazir',
      'fagundes',
      'kike',
      'scunthorpe',
      'classic',
      'dragon_88',
      // Two innocent words that only spell one when run together.
      'chin_king',
      'king_ookami',
      'bean_eric',
      'tran_nyx',
    ]) {
      expect([innocent, await claim(player, innocent)]).toEqual([innocent, 'ok']);
    }
  });

  it('still catches those shorter slurs inside one word', async () => {
    const player = await createUser(db);
    for (const offensive of ['ch1nk', 'xxgookxx', 'the_beaners', 'tranny-99']) {
      expect([offensive, await claim(player, offensive)]).toEqual([offensive, 'reserved']);
    }
  });

  describe('a name shown to others', () => {
    const allowed = async (name: string | null): Promise<boolean> => {
      const [row] = await db.query<{ allowed: boolean }>(
        'select public.name_allowed($1) as allowed',
        [name],
      );
      return row.allowed;
    };
    const setName = async (userId: string, name: string | null): Promise<string> => {
      const [row] = await db.asServer<{ answer: string }>(
        'select public.set_display_name($1, $2) as answer',
        [userId, name],
      );
      return row.answer;
    };
    const nameOf = async (userId: string): Promise<string | null> => {
      const [row] = await db.query<{ display_name: string | null }>(
        'select display_name from profiles where id = $1',
        [userId],
      );
      return row.display_name;
    };

    it('can be anything a person is called: spaces, capitals, other alphabets, emoji', async () => {
      for (const name of [
        'Mist Kai',
        'QA Tester 🎮',
        'ミスト',
        'Ramón Añejo',
        "D'Artagnan",
        'xX_Slayer_Xx',
        'The Therapist',
        'Chin King',
        'Support Main',
        'Staff of Fire',
        'My Backlog Is Endless',
        'Admiral',
        '🎮',
      ]) {
        expect([name, await allowed(name)]).toEqual([name, true]);
      }
    });

    it('cannot be offensive, however it is written', async () => {
      for (const name of [
        'Nigger',
        'N1gg3r Slayer',
        'n i g g e r',
        'N.I.G.G.A',
        'Ｎｉｇｇｅｒ',
        '𝖓𝖎𝖌𝖌𝖊𝖗',
        'Fággot',
        'Nazi',
        'The Rapist',
        'xX Hitler Xx',
      ]) {
        expect([name, await allowed(name)]).toEqual([name, false]);
      }
    });

    it('cannot pass for the app or its staff', async () => {
      for (const name of [
        'Admin',
        'ADMIN',
        'Moderator',
        'Support',
        'Staff',
        'MyBacklog',
        'My Backlog',
        'MyBacklog Support',
        'The MyBacklog Team',
        'Official MyBacklog',
        'Ｍｙ Ｂａｃｋｌｏｇ',
      ]) {
        expect([name, await allowed(name)]).toEqual([name, false]);
      }
    });

    it('is saved when it can be shown, and cleared with null', async () => {
      const player = await createUser(db);
      expect(await setName(player, 'QA Tester 🎮')).toBe('ok');
      expect(await nameOf(player)).toBe('QA Tester 🎮');
      expect(await setName(player, null)).toBe('ok');
      expect(await nameOf(player)).toBeNull();
    });

    it('is refused, and the old one kept, when it cannot', async () => {
      const player = await createUser(db);
      await setName(player, 'Mist Kai');
      expect(await setName(player, 'N1gger')).toBe('refused');
      expect(await setName(player, 'MyBacklog Support')).toBe('refused');
      expect(await setName(player, 'x'.repeat(41))).toBe('invalid');
      expect(await nameOf(player)).toBe('Mist Kai');
      expect(await setName('00000000-0000-0000-0000-000000000000', 'Mist Kai')).toBe('no_profile');
    });

    it('leaves the username alone', async () => {
      const player = await createUser(db);
      const before = await profileOf(player);
      await setName(player, 'Mist Kai');
      expect(await profileOf(player)).toEqual(before);
    });
  });

  it('gives "player" and a number, not a username made from an offensive name', async () => {
    expect(await usernameFrom('N1gger Slayer')).toBeNull();
    expect(await usernameFrom('Nazi')).toBeNull();
    expect((await profileOf(await createNamed({ steam: 'xX H1tler Xx' }))).username).toMatch(
      /^player\d{4}$/,
    );
    const player = await createUser(db);
    expect(await renameGiven(player, 'faggot')).toBeNull();
    expect((await profileOf(player)).username).toMatch(/^player\d{4}$/);
  });

  it('lets a player keep the one they have, even a word reserved since', async () => {
    const player = await createUser(db);
    // As it would be had "admin" been taken before it was reserved.
    await db.query(`update profiles set username = 'admin' where id = $1`, [player]);
    expect(await claim(player, 'admin')).toBe('ok');
    expect(await profileOf(player)).toEqual({ username: 'admin', username_auto: false });
    // And the profile still saves.
    await db.asServer(`update profiles set steam_username = 'Boss' where id = $1`, [player]);
  });

  it('says so when there is no such profile', async () => {
    expect(await claim('00000000-0000-0000-0000-000000000000', 'mistkai')).toBe('no_profile');
  });

  it('never holds two profiles with one username', async () => {
    const first = await createUser(db);
    const second = await createUser(db);
    await claim(first, 'mistkai');
    await expect(
      db.asServer(`update profiles set username = 'mistkai' where id = $1`, [second]),
    ).rejects.toThrow(/profiles_username_key/);
  });

  it('renames a profile still called "player" after its Steam name, once', async () => {
    const player = await createUser(db);
    expect(await renameGiven(player, 'Gordon Freeman')).toBe('gordonfreeman');
    expect((await profileOf(player)).username).toBe('gordonfreeman');
    // Another Steam account linked later doesn't move the address again.
    expect(await renameGiven(player, 'Alyx Vance')).toBeNull();
    expect((await profileOf(player)).username).toBe('gordonfreeman');
  });

  it('leaves a username the player picked, even one that looks given', async () => {
    const player = await createUser(db);
    await claim(player, 'player77');
    expect(await renameGiven(player, 'Gordon Freeman')).toBeNull();
    expect((await profileOf(player)).username).toBe('player77');
  });

  it('keeps the "player" username when the Steam name gives none, and numbers a taken one', async () => {
    const first = await createUser(db);
    const given = (await profileOf(first)).username;
    expect(await renameGiven(first, 'ミスト')).toBeNull();
    expect(await renameGiven(first, null)).toBeNull();
    expect((await profileOf(first)).username).toBe(given);

    await renameGiven(first, 'Gordon');
    const second = await createUser(db);
    expect(await renameGiven(second, 'gordon')).toMatch(/^gordon\d{2}$/);
  });

  it('is read by its own player, and by nobody else', async () => {
    const player = await createUser(db);
    const other = await createUser(db);
    await claim(player, 'mistkai');
    expect(await db.asUser(player, 'select username from profiles')).toEqual([
      { username: 'mistkai' },
    ]);
    expect(await db.asUser(other, 'select username from profiles where id = $1', [player])).toEqual(
      [],
    );
    expect(await db.asVisitor('select username from profiles')).toEqual([]);
  });

  it('is changed through the server only', async () => {
    const player = await createUser(db);
    await expect(
      db.asUser(player, `update profiles set username = 'mistkai' where id = $1`, [player]),
    ).rejects.toThrow(/permission denied/);
    for (const call of [
      `select public.claim_username('${player}', 'mistkai')`,
      `select public.rename_given_username('${player}', 'Mist Kai')`,
      `select public.free_username('Mist Kai')`,
      `select public.username_from('Mist Kai')`,
      `select public.username_reserved('admin')`,
      `select public.username_offensive('admin')`,
      `select public.name_allowed('Mist Kai')`,
      `select public.set_display_name('${player}', 'Mist Kai')`,
    ]) {
      await expect(db.asUser(player, call)).rejects.toThrow(/permission denied/);
      await expect(db.asVisitor(call)).rejects.toThrow(/permission denied/);
    }
  });
});

describe('the usernames migration, on profiles from before it', () => {
  let db: TestDatabase;

  const usernames = async (): Promise<Record<string, string | null>> => {
    const rows = await db.query<{ email: string; username: string | null }>(
      'select u.email, p.username from profiles p join auth.users u on u.id = p.id',
    );
    return Object.fromEntries(rows.map((row) => [row.email, row.username]));
  };

  beforeAll(async () => {
    db = await createDatabaseWithoutUsernames();
    // Oldest first: [email, chosen name, Steam name].
    const accounts: [string, string | null, string | null][] = [
      ['first@example.com', 'Mist Kai', 'steamy'],
      ['second@example.com', null, 'Gordon Freeman'],
      ['third@example.com', 'mistkai', null],
      ['fourth@example.com', null, null],
      ['fifth@example.com', 'ミスト', 'Alyx'],
      ['sixth@example.com', 'Admin', null],
    ];
    for (const [index, [email, display, steam]] of accounts.entries()) {
      const [user] = await db.query<{ id: string }>(
        'insert into auth.users (email) values ($1) returning id',
        [email],
      );
      await db.query(
        `update profiles set display_name = $2, steam_username = $3,
           created_at = now() - make_interval(days => $4)
         where id = $1`,
        [user.id, display, steam, accounts.length - index],
      );
    }
    await db.exec(MIGRATION);
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it('names each after the name it has, the oldest account first, and never its email', async () => {
    const named = await usernames();
    expect(named['first@example.com']).toBe('mistkai');
    expect(named['second@example.com']).toBe('gordonfreeman');
    expect(named['third@example.com']).toMatch(/^mistkai\d{2}$/);
    expect(named['fourth@example.com']).toMatch(/^player\d{4}$/);
    expect(named['fifth@example.com']).toBe('alyx');
    expect(named['sixth@example.com']).toMatch(/^player\d{4}$/);
  });

  it('changes nothing when run again', async () => {
    const before = await usernames();
    await db.exec(MIGRATION);
    expect(await usernames()).toEqual(before);
  });

  it('leaves no profile without one, and names the next account made', async () => {
    await expect(db.query('update profiles set username = null')).rejects.toThrow(
      /not-null|null value/,
    );
    const [user] = await db.query<{ id: string }>(
      'insert into auth.users default values returning id',
    );
    const [profile] = await db.query<{ username: string }>(
      'select username from profiles where id = $1',
      [user.id],
    );
    expect(profile.username).toMatch(/^player\d{4}$/);
  });
});
