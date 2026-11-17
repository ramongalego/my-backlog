import { playsOf, type HistoryEvent } from '@/lib/account/history';

const event = (
  kind: HistoryEvent['kind'],
  changes: HistoryEvent['changes'],
  created_at = '2026-11-20T09:00:00+00:00',
): HistoryEvent => ({ kind, changes, created_at });

const hours = (before: number | null, after: number): [unknown, unknown] => [before, after];

describe('playsOf', () => {
  it('counts hours going up, dated when the game was last played', () => {
    expect(
      playsOf([
        event('playtime', {
          playtime_forever: hours(600, 660),
          last_played_at: ['2026-11-10T21:00:00+00:00', '2026-11-16T22:15:00+00:00'],
        }),
      ]),
    ).toEqual([{ minutes: 60, at: '2026-11-16T22:15:00+00:00' }]);
  });

  it('dates a play when it was logged, where nothing says when it was played', () => {
    expect(
      playsOf([event('playtime', { playtime_forever: hours(0, 45) }, '2026-11-18T08:00:00+00:00')]),
    ).toEqual([{ minutes: 45, at: '2026-11-18T08:00:00+00:00' }]);
  });

  it('counts hours that changed along with a status, in the same sitting', () => {
    expect(
      playsOf([
        event('status', {
          status: ['playing', 'finished'],
          playtime_forever: hours(1200, 1290),
        }),
      ]),
    ).toEqual([{ minutes: 90, at: '2026-11-20T09:00:00+00:00' }]);
  });

  it("doesn't count the hours a game arrives with: they were played before", () => {
    expect(
      playsOf([
        event('added', { status: [null, 'finished'], playtime_forever: hours(null, 720) }),
        event('playtime', { playtime_forever: hours(720, 780) }),
      ]).map((play) => play.minutes),
    ).toEqual([60]);
  });

  it("doesn't count a total that goes down: that's a correction", () => {
    expect(
      playsOf([
        event('playtime', { playtime_forever: hours(720, 780) }),
        event('playtime', { playtime_forever: hours(780, 750) }),
        event('playtime', { playtime_forever: hours(750, 750) }),
      ]).map((play) => play.minutes),
    ).toEqual([60]);
  });

  it('starts counting again when a Steam game moves to a console, and again when it moves back', () => {
    const plays = playsOf([
      // Added from a console: the hours become the ones entered for it.
      event('edit', {
        platform: ['PC', 'Xbox'],
        playtime_forever: hours(3000, 300),
      }),
      // An hour on the console.
      event('playtime', { playtime_forever: hours(300, 360) }),
      // Played on Steam again: the console's hours stay until the next sync.
      event('edit', { platform: ['Xbox', 'PC'] }),
      // The sync brings Steam's total back: not 45 hours played overnight.
      event('playtime', { playtime_forever: hours(360, 3050) }),
      // Then real play on Steam.
      event('playtime', { playtime_forever: hours(3050, 3110) }),
    ]);
    expect(plays.map((play) => play.minutes)).toEqual([60, 60]);
  });

  it("doesn't count more hours entered for a console than Steam had, when the game is moved", () => {
    expect(
      playsOf([event('edit', { platform: ['PC', 'Switch'], playtime_forever: hours(14, 300) })]),
    ).toEqual([]);
  });

  it('is nothing for a game whose hours never changed', () => {
    expect(playsOf([])).toEqual([]);
    expect(
      playsOf([
        event('added', { status: [null, 'backlog'] }),
        event('status', { status: ['backlog', 'playing'] }),
        event('edit', { rating: [null, 8] }),
      ]),
    ).toEqual([]);
  });
});
