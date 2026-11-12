import { isReleased, nextPlayable, upcomingRelease } from '@/lib/games/release-date';

// Oct 27, 2026, mid-afternoon, local time.
const NOW = new Date(2026, 9, 27, 15, 0).getTime();

describe('upcomingRelease', () => {
  it('tags a game out later this year with its day', () => {
    expect(upcomingRelease('Nov 5, 2026', NOW)).toEqual({
      label: 'Out Nov 5',
      detail: 'Releases Nov 5, 2026 (in 9 days)',
    });
  });

  it("reads Steam's day-first dates too", () => {
    expect(upcomingRelease('5 Nov, 2026', NOW)?.label).toBe('Out Nov 5');
  });

  it("adds the year when it's not this one", () => {
    expect(upcomingRelease('Feb 12, 2027', NOW)?.label).toBe('Out Feb 12, 2027');
  });

  it('counts down in the last week', () => {
    expect(upcomingRelease('Nov 3, 2026', NOW)?.label).toBe('Out in 7 days');
    expect(upcomingRelease('Oct 29, 2026', NOW)?.label).toBe('Out in 2 days');
    expect(upcomingRelease('Oct 28, 2026', NOW)).toEqual({
      label: 'Out tomorrow',
      detail: 'Releases Oct 28, 2026 (tomorrow)',
    });
  });

  it('drops the tag on release day and after', () => {
    expect(upcomingRelease('Oct 27, 2026', NOW)).toBeNull();
    expect(upcomingRelease('Sep 17, 2026', NOW)).toBeNull();
  });

  it('marks games with no date yet, and ones known only by year or quarter', () => {
    expect(upcomingRelease('To be announced', NOW)?.label).toBe('Coming soon');
    expect(upcomingRelease('Coming soon', NOW)?.label).toBe('Coming soon');
    expect(upcomingRelease('Q2 2027', NOW)?.label).toBe('Out Q2 2027');
    expect(upcomingRelease('2027', NOW)?.label).toBe('Out 2027');
    expect(upcomingRelease('2025', NOW)).toBeNull();
  });

  it('has nothing to say without a date', () => {
    expect(upcomingRelease(null, NOW)).toBeNull();
    expect(upcomingRelease('', NOW)).toBeNull();
  });
});

describe('isReleased', () => {
  it("is false for a date still to come or none announced, true once it's out or unknown", () => {
    expect(isReleased('Nov 10, 2026', NOW)).toBe(false);
    expect(isReleased('Coming soon', NOW)).toBe(false);
    expect(isReleased('2027', NOW)).toBe(false);
    expect(isReleased('Oct 1, 2026', NOW)).toBe(true);
    expect(isReleased('Sep 28, 2010', NOW)).toBe(true);
    expect(isReleased(null, NOW)).toBe(true);
  });
});

describe('nextPlayable', () => {
  const queued = (name: string, release_date: string | null) => ({ name, game: { release_date } });

  it("skips queued games that aren't out yet", () => {
    const queue = [
      queued('Metroid Ravenous', 'Jan 28, 2027'),
      queued('Eternal Anima', 'To be announced'),
      queued('Metroid Dread', 'Oct 8, 2021'),
      queued('Metroid Fusion', null),
    ];
    expect(nextPlayable(queue, NOW)?.name).toBe('Metroid Dread');
    expect(nextPlayable(queue.slice(0, 2), NOW)).toBeUndefined();
    expect(nextPlayable([], NOW)).toBeUndefined();
  });
});

describe('read in UTC, as the server renders it and the browser first repeats it', () => {
  // The same moment whatever zone the tests run in: 23:30 UTC on Dec 2.
  const lateOnTheSecond = Date.UTC(2026, 11, 2, 23, 30);
  const earlyOnTheThird = Date.UTC(2026, 11, 3, 0, 30);

  it('goes by the UTC day, wherever it runs', () => {
    expect(upcomingRelease('Dec 3, 2026', lateOnTheSecond, 'utc')?.label).toBe('Out tomorrow');
    expect(upcomingRelease('Dec 3, 2026', earlyOnTheThird, 'utc')).toBeNull();
    expect(isReleased('Dec 3, 2026', lateOnTheSecond, 'utc')).toBe(false);
    expect(isReleased('Dec 3, 2026', earlyOnTheThird, 'utc')).toBe(true);
  });

  it('counts the days, and names the day, by the calendar date', () => {
    expect(upcomingRelease('Dec 6, 2026', lateOnTheSecond, 'utc')).toEqual({
      label: 'Out in 4 days',
      detail: 'Releases Dec 6, 2026 (in 4 days)',
    });
    expect(upcomingRelease('Dec 25, 2026', lateOnTheSecond, 'utc')?.label).toBe('Out Dec 25');
    expect(upcomingRelease('Feb 12, 2027', lateOnTheSecond, 'utc')?.label).toBe('Out Feb 12, 2027');
  });

  it('ends a year-only release with the UTC year', () => {
    const newYearsEve = Date.UTC(2026, 11, 31, 23, 30);
    const newYearsDay = Date.UTC(2027, 0, 1, 0, 30);
    expect(upcomingRelease('2026', newYearsEve, 'utc')?.label).toBe('Out 2026');
    expect(upcomingRelease('2026', newYearsDay, 'utc')).toBeNull();
  });

  it('agrees with the local reading whenever it is the same day in both', () => {
    // Midday UTC is the same calendar day in every zone from UTC-11 to UTC+11.
    const midday = Date.UTC(2026, 9, 27, 12, 0);
    for (const date of [
      'Oct 27, 2026',
      'Oct 28, 2026',
      'Nov 1, 2026',
      'Nov 5, 2026',
      'Feb 12, 2027',
      'Sep 17, 2026',
      '2027',
      'Q2 2027',
      'To be announced',
      null,
    ]) {
      expect(upcomingRelease(date, midday, 'utc')).toEqual(upcomingRelease(date, midday, 'local'));
    }
  });

  it('picks the next playable game by the same day', () => {
    const queue = [{ name: 'Out on the third', game: { release_date: 'Dec 3, 2026' } }];
    expect(nextPlayable(queue, lateOnTheSecond, 'utc')).toBeUndefined();
    expect(nextPlayable(queue, earlyOnTheThird, 'utc')?.name).toBe('Out on the third');
  });
});
