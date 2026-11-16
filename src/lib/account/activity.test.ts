import { activityDay, recentActivity } from '@/lib/account/activity';
import { toLocalIsoDate } from '@/lib/diary/date-utils';
import { libraryGame as game } from './test-games';

const finished = (id: number, day: string, rating: number | null = null) =>
  game({
    id,
    name: `Finished ${id}`,
    status: 'finished',
    finished_at: `${day}T00:00:00+00:00`,
    rating,
  });
const dropped = (id: number, day: string) =>
  game({ id, name: `Dropped ${id}`, status: 'dropped', dropped_at: `${day}T00:00:00+00:00` });

describe('recentActivity', () => {
  it('lists what was finished and dropped, newest first', () => {
    const entries = recentActivity(
      [finished(1, '2025-08-20', 10), dropped(2, '2026-04-11'), finished(3, '2026-10-19', 9)],
      null,
    );
    expect(entries.map((e) => [e.kind, e.id, e.day, e.rating])).toEqual([
      ['finished', 3, '2026-10-19', 9],
      ['dropped', 2, '2026-04-11', null],
      ['finished', 1, '2025-08-20', 10],
    ]);
  });

  it('leads with the game being played, whenever it was started', () => {
    const started = '2024-02-03T18:30:00Z';
    const entries = recentActivity(
      [finished(1, '2026-10-19'), game({ id: 2, name: 'Ocarina of Time', status: 'playing' })],
      { id: 2, started_at: started },
    );
    expect(entries[0]).toMatchObject({
      kind: 'playing',
      id: 2,
      // The day it was where the player is.
      day: toLocalIsoDate(new Date(started)),
      rating: null,
    });
    expect(entries[1].id).toBe(1);
  });

  it('shows the game being played without a day when its start is not known', () => {
    const playing = game({ id: 2, status: 'playing' });
    expect(recentActivity([playing], null)[0]).toMatchObject({ kind: 'playing', day: null });
    // The playing query is about another game (it's a moment behind the list).
    expect(
      recentActivity([playing], { id: 9, started_at: '2026-11-01T00:00:00Z' })[0].day,
    ).toBeNull();
  });

  it('leaves out a finished or dropped game saved without a date', () => {
    const entries = recentActivity(
      [
        game({ id: 1, status: 'finished' }),
        game({ id: 2, status: 'dropped' }),
        finished(3, '2026-01-01'),
      ],
      null,
    );
    expect(entries.map((e) => e.id)).toEqual([3]);
  });

  it('goes by what a game is now, not a date left on it from before', () => {
    // Finished once, then put back in the backlog; dropped once, then finished.
    const entries = recentActivity(
      [
        game({ id: 1, status: 'backlog', finished_at: '2026-06-01T00:00:00+00:00' }),
        game({
          id: 2,
          status: 'finished',
          finished_at: '2026-07-01T00:00:00+00:00',
          dropped_at: '2026-02-01T00:00:00+00:00',
        }),
      ],
      null,
    );
    expect(entries.map((e) => [e.kind, e.id, e.day])).toEqual([['finished', 2, '2026-07-01']]);
  });

  it('breaks a tie on the same day by the newer game, and keeps to the limit', () => {
    const games = Array.from({ length: 9 }, (_, i) => finished(i + 1, '2026-05-05'));
    expect(recentActivity(games, null).map((e) => e.id)).toEqual([9, 8, 7, 6, 5, 4]);
    expect(recentActivity(games, null, 2).map((e) => e.id)).toEqual([9, 8]);
  });

  it('carries what the row draws: the name, art and where it was played', () => {
    const entry = recentActivity(
      [
        game({
          id: 4,
          name: 'Metaphor: ReFantazio',
          source: 'manual',
          platform: 'PS5',
          header_image: 'https://example.com/metaphor.jpg',
          status: 'finished',
          finished_at: '2024-11-09T00:00:00+00:00',
          rating: 9,
        }),
      ],
      null,
    )[0];
    expect(entry).toEqual({
      id: 4,
      kind: 'finished',
      name: 'Metaphor: ReFantazio',
      header_image: 'https://example.com/metaphor.jpg',
      source: 'manual',
      platform: 'PS5',
      day: '2024-11-09',
      rating: 9,
    });
  });

  it('is empty for a library with nothing started, finished or dropped', () => {
    expect(recentActivity([game(), game({ id: 2, status: 'hidden' })], null)).toEqual([]);
  });
});

describe('activityDay', () => {
  const now = new Date(2026, 10, 15);

  it('is the month and day for this year', () => {
    expect(activityDay('2026-10-09', now)).toBe('Oct 9');
  });

  it('adds the year for any other', () => {
    expect(activityDay('2025-08-20', now)).toBe('Aug 20, 2025');
  });
});
