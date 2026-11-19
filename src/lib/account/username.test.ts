import { cleanUsername, usernameProblem } from './username';

describe('cleanUsername', () => {
  it('lowers capitals and drops the spaces around it', () => {
    expect(cleanUsername('  MistKai ')).toBe('mistkai');
  });
});

describe('usernameProblem', () => {
  it('finds nothing wrong with letters, numbers, - and _, 3 to 20 of them', () => {
    for (const fine of ['abc', 'mist_kai-7', '123', 'x'.repeat(20), '_a_']) {
      expect(usernameProblem(fine)).toBeNull();
    }
  });

  it('says what is wrong, one thing at a time', () => {
    expect(usernameProblem('')).toBe('Enter a username');
    expect(usernameProblem('ab')).toBe('Use at least 3 characters');
    expect(usernameProblem('x'.repeat(21))).toBe('Keep it to 20 characters');
    expect(usernameProblem('mist kai')).toBe('Use only letters, numbers, - and _');
    expect(usernameProblem('mist.kai')).toBe('Use only letters, numbers, - and _');
    expect(usernameProblem('místkai')).toBe('Use only letters, numbers, - and _');
    expect(usernameProblem('___')).toBe('Add at least one letter or number');
  });

  it('agrees with the rule the database holds', () => {
    // profiles_username_format in supabase/schema.sql.
    const database = (name: string) => /^[a-z0-9_-]{3,20}$/.test(name) && /[a-z0-9]/.test(name);
    for (const name of [
      'abc',
      'ab',
      '',
      '___',
      'a-b',
      'Abc',
      'a b',
      'x'.repeat(20),
      'x'.repeat(21),
    ]) {
      expect(usernameProblem(name) === null).toBe(database(name));
    }
  });
});
