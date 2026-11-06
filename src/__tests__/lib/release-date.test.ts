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
