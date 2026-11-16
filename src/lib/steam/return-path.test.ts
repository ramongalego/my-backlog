import { steamReturnPath, withSteamOutcome } from '@/lib/steam/return-path';

const ORIGIN = 'https://mybacklog.test';

describe('steamReturnPath', () => {
  it('goes back to the page Connect Steam was pressed on, with its own query', () => {
    expect(steamReturnPath('/profile', ORIGIN)).toBe('/profile');
    expect(steamReturnPath('/games?status=backlog&platform=PC', ORIGIN)).toBe(
      '/games?status=backlog&platform=PC',
    );
  });

  it('only ever goes to a page of this site', () => {
    for (const elsewhere of [
      'https://evil.test/profile',
      '//evil.test/profile',
      '/\\evil.test',
      'profile',
      'javascript:alert(1)',
      '',
      null,
      undefined,
    ]) {
      expect(steamReturnPath(elsewhere, ORIGIN)).toBe('/');
    }
  });

  it("doesn't go back into the API", () => {
    expect(steamReturnPath('/api/steam/auth', ORIGIN)).toBe('/');
  });

  it('leaves out a message from an earlier try, so it is not said again', () => {
    expect(steamReturnPath('/profile?error=steam_link_limited&tab=1&notice=x', ORIGIN)).toBe(
      '/profile?tab=1',
    );
  });
});

it('adds how it went to the page, for the page to say', () => {
  expect(withSteamOutcome('/profile', ORIGIN, 'steam_link_limited').toString()).toBe(
    `${ORIGIN}/profile?error=steam_link_limited`,
  );
  expect(withSteamOutcome('/games?status=backlog', ORIGIN, 'steam_private').toString()).toBe(
    `${ORIGIN}/games?status=backlog&error=steam_private`,
  );
  expect(withSteamOutcome('/profile', ORIGIN).toString()).toBe(`${ORIGIN}/profile`);
});
