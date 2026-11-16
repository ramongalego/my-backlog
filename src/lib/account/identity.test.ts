import { displayName, initialOf, memberSince } from '@/lib/account/identity';

describe('displayName', () => {
  it('is the Steam name when Steam is connected', () => {
    expect(displayName('Ankrath', 'someone@example.com')).toBe('Ankrath');
  });

  it('is the part of the email before the @ otherwise, never the whole address', () => {
    expect(displayName(null, 'someone@example.com')).toBe('someone');
    expect(displayName('   ', 'someone@example.com')).toBe('someone');
    expect(displayName(undefined, 'first.last@mail.co.uk')).toBe('first.last');
  });

  it('has something to show when neither is known', () => {
    expect(displayName(null, null)).toBe('Player');
    expect(displayName(null, '')).toBe('Player');
    expect(displayName(null, '@example.com')).toBe('Player');
  });
});

describe('initialOf', () => {
  it('is the first letter, in capitals', () => {
    expect(initialOf('ankrath')).toBe('A');
    expect(initialOf('  zelda fan')).toBe('Z');
  });

  it('takes a whole character, not half of one', () => {
    expect(initialOf('🎮 player')).toBe('🎮');
    expect(initialOf('')).toBe('?');
  });
});

describe('memberSince', () => {
  it('is the month and year the account was made', () => {
    expect(memberSince('2026-01-18T10:30:00Z')).toBe('January 2026');
  });

  it("is nothing when that isn't known, or can't be read", () => {
    expect(memberSince(null)).toBeNull();
    expect(memberSince(undefined)).toBeNull();
    expect(memberSince('not a date')).toBeNull();
  });
});
