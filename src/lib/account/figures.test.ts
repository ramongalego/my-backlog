import { profileFigures } from '@/lib/account/figures';
import { libraryGame as game } from './test-games';

const now = new Date(2026, 10, 15);

it('counts the library as the Games page does: everything but hidden games', () => {
  const figures = profileFigures(
    [
      game({ id: 1 }),
      game({ id: 2, status: 'playing' }),
      game({ id: 3, status: 'wont_play' }),
      game({ id: 4, status: 'hidden' }),
    ],
    now,
  );
  expect(figures.games).toBe(3);
});

it('counts finished games, and the ones finished this calendar year', () => {
  const figures = profileFigures(
    [
      game({ id: 1, status: 'finished', finished_at: '2026-10-19T00:00:00+00:00' }),
      game({ id: 2, status: 'finished', finished_at: '2026-01-01T00:00:00+00:00' }),
      game({ id: 3, status: 'finished', finished_at: '2025-12-31T00:00:00+00:00' }),
      // Finished with no date: counted, but in no year.
      game({ id: 4, status: 'finished', finished_at: null }),
      // Dropped this year isn't finished.
      game({ id: 5, status: 'dropped', dropped_at: '2026-04-11T00:00:00+00:00' }),
      // Back in the backlog with its old finish date still on it.
      game({ id: 6, status: 'backlog', finished_at: '2026-03-03T00:00:00+00:00' }),
    ],
    now,
  );
  expect(figures.finished).toBe(4);
  expect(figures.finishedThisYear).toBe(2);
});

it("totals the hours as Stats does: without hidden and won't-play games", () => {
  const figures = profileFigures(
    [
      game({ id: 1, playtime_forever: 600 }),
      game({ id: 2, playtime_forever: 95, status: 'finished' }),
      game({ id: 3, playtime_forever: 6000, status: 'hidden' }),
      game({ id: 4, playtime_forever: 6000, status: 'wont_play' }),
    ],
    now,
  );
  // 695 minutes, to the nearest hour.
  expect(figures.hours).toBe(12);
});

it('is all zeros for an empty library', () => {
  expect(profileFigures([], now)).toEqual({ games: 0, finished: 0, finishedThisYear: 0, hours: 0 });
});
