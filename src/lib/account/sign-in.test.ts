import {
  confirmsDelete,
  linkedProviders,
  providerNames,
  signedUpWithPassword,
} from '@/lib/account/sign-in';

const identities = (...providers: string[]) => ({
  identities: providers.map((provider) => ({ provider })),
});

describe('linkedProviders', () => {
  it('lists Google and Discord, in the order they are offered', () => {
    expect(linkedProviders(identities('discord', 'email', 'google'))).toEqual([
      'google',
      'discord',
    ]);
  });

  it('is empty for an account with only a password, or no account', () => {
    expect(linkedProviders(identities('email'))).toEqual([]);
    expect(linkedProviders({ identities: null })).toEqual([]);
    expect(linkedProviders(null)).toEqual([]);
  });

  it('leaves out a sign-in the app does not offer', () => {
    expect(linkedProviders(identities('github', 'google'))).toEqual(['google']);
  });
});

describe('signedUpWithPassword', () => {
  it('is true for an account made with an email and a password', () => {
    expect(signedUpWithPassword(identities('email'))).toBe(true);
    expect(signedUpWithPassword(identities('google', 'email'))).toBe(true);
  });

  it('is false for one made with Google or Discord, or no account', () => {
    expect(signedUpWithPassword(identities('google'))).toBe(false);
    expect(signedUpWithPassword({})).toBe(false);
    expect(signedUpWithPassword(undefined)).toBe(false);
  });
});

describe('confirmsDelete', () => {
  it('takes the word however it is capitalized or spaced', () => {
    expect(confirmsDelete('delete')).toBe(true);
    expect(confirmsDelete(' Delete ')).toBe(true);
    expect(confirmsDelete('DELETE')).toBe(true);
  });

  it('takes nothing else', () => {
    expect(confirmsDelete('delet')).toBe(false);
    expect(confirmsDelete('')).toBe(false);
    expect(confirmsDelete(undefined)).toBe(false);
  });
});

describe('providerNames', () => {
  it('names one, or two with "or"', () => {
    expect(providerNames(['google'])).toBe('Google');
    expect(providerNames(['discord'])).toBe('Discord');
    expect(providerNames(['discord', 'google'])).toBe('Google or Discord');
  });

  it('is empty with none', () => {
    expect(providerNames([])).toBe('');
  });
});
