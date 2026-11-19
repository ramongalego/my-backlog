import { MIN_RATED_FOR_AVERAGE, profileFigures, ratingSpread } from '@/lib/account/figures';
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
  expect(profileFigures([], now)).toEqual({
    games: 0,
    finished: 0,
    finishedThisYear: 0,
    hours: 0,
    avgRating: null,
  });
});

describe('the average rating', () => {
  const rated = (ratings: (number | null)[]) =>
    ratings.map((rating, i) => game({ id: i + 1, status: 'finished', rating }));

  it('is not given until five finished games are rated: one 10/10 is not an average', () => {
    expect(profileFigures(rated([10]), now).avgRating).toBeNull();
    expect(profileFigures(rated([10, 9, 8, 7]), now).avgRating).toBeNull();
    // Finished without a rating is not a rated game.
    expect(profileFigures(rated([10, 9, 8, 7, null, null]), now).avgRating).toBeNull();
    expect(profileFigures(rated([10, 9, 8, 7, 6]), now).avgRating).toBe(8);
    expect(MIN_RATED_FOR_AVERAGE).toBe(5);
  });

  it('is to one decimal, of the rated games only', () => {
    // 41 over 6 rated games is 6.83.
    expect(profileFigures(rated([10, 9, 8, 7, 6, 1, null]), now).avgRating).toBe(6.8);
    expect(profileFigures(rated([7, 7, 7, 7, 8]), now).avgRating).toBe(7.2);
  });

  it('takes finished games only: a rating left on a game since moved off Finished stays out', () => {
    const games = [
      ...rated([8, 8, 8, 8, 8]),
      game({ id: 10, status: 'dropped', rating: 1 }),
      game({ id: 11, status: 'backlog', rating: 1 }),
    ];
    expect(profileFigures(games, now).avgRating).toBe(8);
  });
});

describe('how the ratings are spread', () => {
  const rated = (ratings: (number | null)[]) =>
    ratings.map((rating, i) => game({ id: i + 1, status: 'finished', rating }));

  it('counts the finished games at each rating, 0 to 10', () => {
    expect(ratingSpread(rated([10, 9, 9, 8, 8, 8, 4, 0, null]))).toEqual([
      1, 0, 0, 0, 1, 0, 0, 0, 3, 2, 1,
    ]);
  });

  it('is not given until five are rated, as the average is not', () => {
    expect(ratingSpread([])).toBeNull();
    expect(ratingSpread(rated([10, 9, 8, 7, null, null]))).toBeNull();
    expect(ratingSpread(rated([10, 9, 8, 7, 6]))).not.toBeNull();
  });

  it('takes finished games only, as Stats does', () => {
    const games = [
      ...rated([8, 8, 8, 8, 8]),
      game({ id: 10, status: 'dropped', rating: 1 }),
      game({ id: 11, status: 'playing', rating: 6 }),
    ];
    expect(ratingSpread(games)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0]);
  });

  it('leaves out a rating that is not on the scale, rather than draw a bar for it', () => {
    expect(ratingSpread(rated([8, 8, 8, 8, 8, 11, -1, 7.5]))).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0,
    ]);
  });
});
