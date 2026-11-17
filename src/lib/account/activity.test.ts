import {
  activityDay,
  activityStamp,
  playedFor,
  RECENT_ACTIVITY,
  recentActivity,
  type ActivityEntry,
  type ActivityEvent,
} from '@/lib/account/activity';
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
const dropped = (id: number, day: string, rating: number | null = null) =>
  game({
    id,
    name: `Dropped ${id}`,
    status: 'dropped',
    dropped_at: `${day}T00:00:00+00:00`,
    rating,
  });

/** What an entry's lines say happened, in order. */
const kinds = (entry: ActivityEntry) => entry.lines.map((line) => line.kind);

let lastId = 0;
const event = (
  game_id: number,
  kind: ActivityEvent['kind'],
  changes: ActivityEvent['changes'],
  created_at = '2026-11-17T20:00:00+00:00',
): ActivityEvent => ({ id: ++lastId, game_id, kind, changes, created_at });
/** An hour of the same day, for events that follow each other. */
const at = (hour: number, day = 17) =>
  `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+00:00`;
const hades = game({ id: 7, name: 'Hades' });
const celeste = game({ id: 8, name: 'Celeste' });

describe('recentActivity, from the games', () => {
  it('lists what was finished and dropped, newest first', () => {
    const entries = recentActivity(
      [finished(1, '2025-08-20', 10), dropped(2, '2026-04-11'), finished(3, '2026-10-19', 9)],
      null,
    );
    expect(entries.map((e) => [kinds(e), e.id, e.day, e.rating])).toEqual([
      [['finished'], 3, '2026-10-19', 9],
      [['dropped'], 2, '2026-04-11', null],
      [['finished'], 1, '2025-08-20', 10],
    ]);
  });

  it('puts the game being played where its start falls, like any other line', () => {
    const started = '2026-05-03T18:30:00Z';
    const entries = recentActivity(
      [finished(1, '2026-10-19'), game({ id: 2, status: 'playing' }), finished(3, '2026-01-05')],
      { id: 2, started_at: started },
    );
    expect(entries.map((e) => [e.id, kinds(e), e.day])).toEqual([
      [1, ['finished'], '2026-10-19'],
      // The day it was where the player is.
      [2, ['playing'], toLocalIsoDate(new Date(started))],
      [3, ['finished'], '2026-01-05'],
    ]);
  });

  it('shows the game being played without a day, after the rest, when its start is not known', () => {
    const playing = game({ id: 2, status: 'playing' });
    const entries = recentActivity([playing, finished(1, '2026-10-19')], null);
    expect(entries.map((e) => [e.id, e.day])).toEqual([
      [1, '2026-10-19'],
      [2, null],
    ]);
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
    expect(entries.map((e) => [kinds(e), e.id, e.day])).toEqual([[['finished'], 2, '2026-07-01']]);
  });

  it('breaks a tie on the same day by the newer game, and gives all of them', () => {
    const games = Array.from({ length: 9 }, (_, i) => finished(i + 1, '2026-05-05'));
    expect(recentActivity(games, null).map((e) => e.id)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('holds the latest fifty, however much more there is', () => {
    const games = Array.from({ length: 80 }, (_, i) =>
      finished(i + 1, `2026-0${1 + (i % 9)}-1${i % 10}`),
    );
    const entries = recentActivity(games, null);
    expect(entries).toHaveLength(RECENT_ACTIVITY);
    expect(RECENT_ACTIVITY).toBe(50);
    // The newest of them: none left out is newer than one kept.
    const kept = new Set(entries.map((e) => e.id));
    const oldestKept = entries.at(-1)!.day!;
    for (const game of games) {
      if (!kept.has(game.id)) {
        expect(game.finished_at!.slice(0, 10) <= oldestKept).toBe(true);
      }
    }
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
      key: 'game-4',
      id: 4,
      name: 'Metaphor: ReFantazio',
      header_image: 'https://example.com/metaphor.jpg',
      source: 'manual',
      platform: 'PS5',
      lines: [{ kind: 'finished', rating: 9 }],
      day: '2024-11-09',
      rating: 9,
    });
  });

  it("puts the game's rating on its finish or its drop, and none where it has none", () => {
    const entries = recentActivity(
      [finished(1, '2026-10-19', 10), dropped(2, '2026-04-11', 4), finished(3, '2026-01-05')],
      null,
    );
    expect(entries.map((e) => [e.lines, e.rating])).toEqual([
      [[{ kind: 'finished', rating: 10 }], 10],
      [[{ kind: 'dropped', rating: 4 }], 4],
      [[{ kind: 'finished' }], null],
    ]);
    expect(entries[2].lines[0]).not.toHaveProperty('rating');
  });

  it('is empty for a library with nothing started, finished or dropped', () => {
    expect(recentActivity([game(), game({ id: 2, status: 'hidden' })], null)).toEqual([]);
  });
});

describe('recentActivity, from the history', () => {
  const told = (events: ActivityEvent[], games = [hades]) =>
    recentActivity(games, null, events).flatMap(kinds);
  const loggedOn = toLocalIsoDate(new Date('2026-11-17T20:00:00+00:00'));

  it.each([
    ['a game added by hand', 'added', { status: [null, 'backlog'] }, 'added'],
    [
      'a game added straight to the queue',
      'added',
      { status: [null, 'backlog'], queued: [null, true] },
      'queued',
    ],
    ['a game started and since stopped', 'status', { status: ['backlog', 'playing'] }, 'started'],
    ['a game moved back to the backlog', 'status', { status: ['playing', 'backlog'] }, 'backlog'],
    [
      'a game paused at the top of the queue',
      'status',
      { status: ['playing', 'backlog'], queued: [false, true] },
      'paused',
    ],
    ["a game marked Won't Play", 'status', { status: ['backlog', 'wont_play'] }, 'wont_play'],
    ['a game put on the queue', 'queue', { queued: [false, true] }, 'queued'],
    ['a game taken off the queue', 'queue', { queued: [true, false] }, 'unqueued'],
    ['a game made a favorite', 'favorite', { favorite: [false, true] }, 'favorite'],
    ['a game no longer a favorite', 'favorite', { favorite: [true, false] }, 'unfavorite'],
    ['a note written', 'note', { noted: [false, true] }, 'note'],
  ] as const)('tells %s', (_, kind, changes, said) => {
    const [entry] = recentActivity([hades], null, [event(7, kind, changes as never)]);
    expect(entry).toMatchObject({
      id: 7,
      name: 'Hades',
      lines: [{ kind: said }],
      day: loggedOn,
      rating: null,
    });
  });

  it('lists a finish or a drop when it was logged, with the day the player chose and its rating', () => {
    const entries = recentActivity([hades, celeste], null, [
      event(7, 'status', {
        status: ['playing', 'finished'],
        finished_at: [null, '2026-11-10T00:00:00+00:00'],
        rating: [null, 9],
      }),
      event(8, 'status', {
        status: ['playing', 'dropped'],
        dropped_at: [null, '2026-11-12T00:00:00+00:00'],
      }),
    ]);
    expect(entries.map((e) => [e.lines, e.day, e.rating])).toEqual([
      [[{ kind: 'dropped', on: '2026-11-12' }], loggedOn, null],
      [[{ kind: 'finished', on: '2026-11-10', rating: 9 }], loggedOn, 9],
    ]);
  });

  it('puts the rating a drop came with on its line too', () => {
    const [entry] = recentActivity([hades], null, [
      event(7, 'status', {
        status: ['playing', 'dropped'],
        dropped_at: [null, '2026-11-12T00:00:00+00:00'],
        rating: [null, 3],
      }),
    ]);
    expect(entry.lines).toEqual([{ kind: 'dropped', on: '2026-11-12', rating: 3 }]);
    expect(entry.rating).toBe(3);
  });

  it('tells a game paused for another apart from one put on the queue', () => {
    const entries = recentActivity([hades, celeste, game({ id: 9 }), game({ id: 10 })], null, [
      // Stopped being played and put on the queue in one go: paused.
      event(7, 'status', { status: ['playing', 'backlog'], queued: [false, true] }, at(13)),
      // Put on the queue as it was added, by itself, or from another status.
      event(8, 'added', { status: [null, 'backlog'], queued: [null, true] }, at(12)),
      event(9, 'queue', { queued: [false, true] }, at(11)),
      event(10, 'status', { status: ['dropped', 'backlog'], queued: [false, true] }, at(10)),
    ]);
    expect(entries.map((e) => [e.id, e.lines])).toEqual([
      [7, [{ kind: 'paused' }]],
      [8, [{ kind: 'queued' }]],
      [9, [{ kind: 'queued' }]],
      [10, [{ kind: 'queued' }]],
    ]);
  });

  it("doesn't say the day of a finish again when it was logged that day", () => {
    const [entry] = recentActivity([hades], null, [
      event(7, 'status', {
        status: ['playing', 'finished'],
        finished_at: [null, `${loggedOn}T00:00:00+00:00`],
      }),
    ]);
    expect(entry).toMatchObject({ lines: [{ kind: 'finished' }], day: loggedOn });
    expect(entry.lines[0].on).toBeUndefined();
  });

  it('tells a rating given, a move to another platform, and time played', () => {
    const entries = recentActivity([hades, celeste, game({ id: 9 })], null, [
      event(7, 'edit', { rating: [null, 8] }, at(12)),
      event(8, 'edit', { platform: ['PC', 'Switch'], playtime_forever: [3000, 300] }, at(11)),
      event(9, 'playtime', { playtime_forever: [300, 450] }, at(10)),
    ]);
    expect(entries.map((e) => [e.lines, e.rating])).toEqual([
      [[{ kind: 'rated', rating: 8 }], 8],
      [[{ kind: 'moved', to: 'Switch' }], null],
      [[{ kind: 'played', minutes: 150 }], null],
    ]);
  });

  it.each([
    ['a game hidden', 'status', { status: ['backlog', 'hidden'] }],
    [
      'a date corrected',
      'edit',
      { finished_at: ['2026-11-10T00:00:00+00:00', '2026-11-11T00:00:00+00:00'] },
    ],
    ['a note cleared', 'note', { noted: [true, false] }],
    ['hours corrected down', 'playtime', { playtime_forever: [600, 540] }],
    ['a rating taken away', 'edit', { rating: [8, null] }],
  ] as const)('has no line for %s', (_, kind, changes) => {
    expect(told([event(7, kind, changes as never)])).toEqual([]);
  });

  it('leaves out a hidden game, and a game that is no longer in the library', () => {
    const hidden = game({ id: 8, status: 'hidden' });
    expect(
      told(
        [
          event(8, 'queue', { queued: [false, true] }),
          event(99, 'queue', { queued: [false, true] }),
        ],
        [hades, hidden],
      ),
    ).toEqual([]);
  });

  it('is newest first, by when each was logged', () => {
    const entries = recentActivity([hades, celeste], null, [
      event(7, 'queue', { queued: [false, true] }, at(10)),
      event(8, 'favorite', { favorite: [false, true] }, at(12)),
      event(7, 'queue', { queued: [true, false] }, at(11)),
    ]);
    expect(entries.map((e) => [e.id, kinds(e)])).toEqual([
      [8, ['favorite']],
      [7, ['queued', 'unqueued']],
    ]);
  });

  it('puts the start of the game being played in its place in time, not first', () => {
    const playing = game({ id: 7, name: 'Hades', status: 'playing' });
    const entries = recentActivity([playing, celeste], { id: 7, started_at: at(10) }, [
      event(7, 'status', { status: ['backlog', 'playing'] }, at(10)),
      // Made a favorite an hour after the game was started.
      event(8, 'favorite', { favorite: [false, true] }, at(11)),
    ]);
    expect(entries.map((e) => [e.id, kinds(e)])).toEqual([
      [8, ['favorite']],
      [7, ['playing']],
    ]);
  });

  it('says the game being played once: by its start in the history, not again from the game', () => {
    const playing = game({ id: 7, name: 'Hades', status: 'playing' });
    const entries = recentActivity([playing], { id: 7, started_at: at(10) }, [
      event(7, 'status', { status: ['backlog', 'playing'] }, at(10)),
    ]);
    expect(entries.map(kinds)).toEqual([['playing']]);
  });

  it('tells an earlier start of the game being played as a start like any other', () => {
    const playing = game({ id: 7, name: 'Hades', status: 'playing' });
    const entries = recentActivity([playing], { id: 7, started_at: at(10) }, [
      event(7, 'status', { status: ['backlog', 'playing'] }, at(10, 1)),
      event(7, 'status', { status: ['playing', 'backlog'] }, at(10, 5)),
      event(7, 'status', { status: ['backlog', 'playing'] }, at(10)),
    ]);
    expect(entries.map(kinds)).toEqual([['playing'], ['backlog'], ['started']]);
  });

  it('says a finish once, whether the history or the game tells it', () => {
    const done = finished(7, '2026-11-10', 9);
    const entries = recentActivity([done, finished(8, '2026-03-01')], null, [
      event(7, 'status', {
        status: ['playing', 'finished'],
        finished_at: [null, '2026-11-10T00:00:00+00:00'],
        rating: [null, 9],
      }),
    ]);
    // The one the history tells, then the one from before there was a history.
    expect(entries.map((e) => [e.id, e.lines, e.day])).toEqual([
      [7, [{ kind: 'finished', on: '2026-11-10', rating: 9 }], loggedOn],
      [8, [{ kind: 'finished' }], '2026-03-01'],
    ]);
  });

  it('is what the games say when there is no history to read', () => {
    expect(recentActivity([finished(1, '2026-10-19', 9)], null, []).map(kinds)).toEqual([
      ['finished'],
    ]);
  });
});

describe('recentActivity, several things about one game', () => {
  const queued = (hour: number, day?: number) =>
    event(7, 'queue', { queued: [false, true] }, at(hour, day));
  const started = (hour: number, day?: number) =>
    event(7, 'status', { status: ['backlog', 'playing'] }, at(hour, day));
  const done = (hour: number, day?: number) =>
    event(
      7,
      'status',
      {
        status: ['playing', 'finished'],
        finished_at: [null, '2026-11-17T00:00:00+00:00'],
        rating: [null, 10],
      },
      at(hour, day),
    );

  it('is one entry, its lines in the order they happened, with the latest day and the rating', () => {
    const entries = recentActivity([hades], null, [done(15), started(11), queued(9)]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 7,
      lines: [{ kind: 'queued' }, { kind: 'started' }, { kind: 'finished' }],
      // The day the latest of them was logged.
      day: toLocalIsoDate(new Date(at(15))),
      rating: 10,
    });
  });

  it('is two entries when another game comes between', () => {
    const entries = recentActivity([hades, celeste], null, [
      queued(9),
      event(8, 'favorite', { favorite: [false, true] }, at(10)),
      started(11),
    ]);
    expect(entries.map((e) => [e.id, kinds(e)])).toEqual([
      [7, ['started']],
      [8, ['favorite']],
      [7, ['queued']],
    ]);
  });

  it('is two entries when more than twelve hours pass between two lines', () => {
    const entries = recentActivity([hades], null, [queued(12, 16), started(21, 16), done(10, 17)]);
    // Thirteen hours from the start to the finish.
    expect(entries.map(kinds)).toEqual([['finished'], ['queued', 'started']]);
  });

  it('goes on as one entry while each line is within twelve hours of the last', () => {
    const entries = recentActivity([hades], null, [queued(8, 16), started(19, 16), done(6, 17)]);
    expect(entries.map(kinds)).toEqual([['queued', 'started', 'finished']]);
  });

  it('adds up time played in a row', () => {
    const entries = recentActivity([hades], null, [
      event(7, 'playtime', { playtime_forever: [0, 60] }, at(9)),
      event(7, 'playtime', { playtime_forever: [60, 150] }, at(12)),
      event(7, 'edit', { rating: [null, 8] }, at(13)),
      event(7, 'playtime', { playtime_forever: [150, 180] }, at(14)),
    ]);
    expect(entries[0].lines).toEqual([
      { kind: 'played', minutes: 150 },
      { kind: 'rated', rating: 8 },
      { kind: 'played', minutes: 30 },
    ]);
  });

  it('keeps the rating on the line it came with, not on the others', () => {
    // Finished on the day it was logged, so the line says no day of its own.
    const finishedOn = toLocalIsoDate(new Date(at(15)));
    const [entry] = recentActivity([hades], null, [
      queued(9),
      started(11),
      event(
        7,
        'status',
        {
          status: ['playing', 'finished'],
          finished_at: [null, `${finishedOn}T00:00:00+00:00`],
          rating: [null, 10],
        },
        at(15),
      ),
    ]);
    expect(entry.lines).toEqual([
      { kind: 'queued' },
      { kind: 'started' },
      { kind: 'finished', rating: 10 },
    ]);
    expect(entry.lines[0]).not.toHaveProperty('rating');
    expect(entry.lines[1]).not.toHaveProperty('rating');
    expect(entry.rating).toBe(10);
  });

  it('gives the entry the latest rating of its lines, each line keeping its own', () => {
    const [entry] = recentActivity([hades], null, [
      done(9),
      event(7, 'edit', { rating: [10, 8] }, at(11)),
    ]);
    expect(entry.lines).toMatchObject([
      { kind: 'finished', rating: 10 },
      { kind: 'rated', rating: 8 },
    ]);
    expect(entry.rating).toBe(8);
  });

  it('keeps its key as more is done to the game, and gives each entry its own', () => {
    const first = [queued(9)];
    const more = [...first, started(11)];
    const [before] = recentActivity([hades], null, first);
    const [after] = recentActivity([hades], null, more);
    expect(after.key).toBe(before.key);

    const entries = recentActivity([hades, celeste], null, [
      queued(9),
      event(8, 'favorite', { favorite: [false, true] }, at(10)),
      started(11),
    ]);
    expect(new Set(entries.map((e) => e.key)).size).toBe(3);
  });

  it("doesn't join what the game says with a line of the history from another day", () => {
    const entries = recentActivity([finished(7, '2026-03-01')], null, [queued(9)]);
    expect(entries.map(kinds)).toEqual([['queued'], ['finished']]);
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

describe('activityStamp', () => {
  const now = new Date(2026, 10, 15);

  it('is the day of the month and the month, with no year for this year', () => {
    expect(activityStamp('2026-10-09', now)).toEqual({ day: '9', month: 'Oct', year: null });
  });

  it('gives the year by itself for a day in another year, the month still only the month', () => {
    expect(activityStamp('2025-08-20', now)).toEqual({ day: '20', month: 'Aug', year: '2025' });
    expect(activityStamp('2027-01-02', now)).toEqual({ day: '2', month: 'Jan', year: '2027' });
  });
});

describe('playedFor', () => {
  it.each([
    [45, '45m'],
    [60, '1h'],
    [150, '2h 30m'],
    [1500, '25h'],
  ])('writes %i minutes as %s', (minutes, said) => {
    expect(playedFor(minutes)).toBe(said);
  });
});
