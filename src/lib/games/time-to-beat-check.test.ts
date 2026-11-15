import { SHORTEST_RECHECK_DAYS, timeToBeatCheckDue } from '@/lib/games/time-to-beat-check';

const now = Date.parse('2026-11-10T12:00:00Z');
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
/** A release date as it's stored: display text. */
const releasedDaysAgo = (days: number) =>
  new Date(now - days * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

const due = (game: { hours?: number | null; released?: string | null; checked?: string | null }) =>
  timeToBeatCheckDue(
    {
      main_story_hours: game.hours ?? null,
      release_date: game.released ?? null,
      hltb_checked_at: game.checked ?? null,
    },
    now,
  );

describe('a game with no time yet', () => {
  it('is checked straight away, then weekly', () => {
    expect(due({})).toBe(true);
    expect(due({ checked: daysAgo(6) })).toBe(false);
    expect(due({ checked: daysAgo(7) })).toBe(true);
  });

  it('is checked whether or not it is out, or has a date at all', () => {
    expect(due({ released: 'Mar 1, 2027' })).toBe(true);
    expect(due({ released: 'Coming soon' })).toBe(true);
    expect(due({ released: releasedDaysAgo(2000) })).toBe(true);
  });
});

describe('a game with a time', () => {
  it('is checked weekly in its first three months out', () => {
    const released = releasedDaysAgo(54);
    expect(due({ hours: 78.5, released })).toBe(true);
    expect(due({ hours: 78.5, released, checked: daysAgo(6) })).toBe(false);
    expect(due({ hours: 78.5, released, checked: daysAgo(7) })).toBe(true);
  });

  it('is checked monthly from then until it has been out a year', () => {
    const released = releasedDaysAgo(200);
    expect(due({ hours: 40, released })).toBe(true);
    expect(due({ hours: 40, released, checked: daysAgo(8) })).toBe(false);
    expect(due({ hours: 40, released, checked: daysAgo(29) })).toBe(false);
    expect(due({ hours: 40, released, checked: daysAgo(30) })).toBe(true);
  });

  it('is left alone once it has been out a year: the time has settled', () => {
    expect(due({ hours: 40, released: releasedDaysAgo(364), checked: daysAgo(40) })).toBe(true);
    expect(due({ hours: 40, released: releasedDaysAgo(366) })).toBe(false);
    expect(due({ hours: 101, released: 'Mar 31, 2020' })).toBe(false);
  });

  it('is left alone when it is not out yet, or its date is not known', () => {
    expect(due({ hours: 30, released: 'Mar 1, 2027' })).toBe(false);
    expect(due({ hours: 30, released: null })).toBe(false);
    expect(due({ hours: 30, released: 'Coming soon' })).toBe(false);
  });

  it('reads a date written day first, as Steam sometimes gives it', () => {
    expect(due({ hours: 78.5, released: '17 Sep, 2026' })).toBe(true);
  });
});

it('treats a check time it cannot read as never checked', () => {
  expect(due({ checked: 'not a date' })).toBe(true);
});

it('says how recently checked a game can be and still be due, for the query', () => {
  expect(SHORTEST_RECHECK_DAYS).toBe(7);
  // Nothing checked within that many days is ever due.
  for (const released of [releasedDaysAgo(10), releasedDaysAgo(200), null]) {
    for (const hours of [null, 40]) {
      expect(due({ hours, released, checked: daysAgo(SHORTEST_RECHECK_DAYS - 0.5) })).toBe(false);
    }
  }
});
