import {
  activityAgo,
  activityDay,
  HIGHLIGHTS,
  playedFor,
  RECENT_ACTIVITY,
  recentActivity,
  type ActivityEntry,
  type ActivityEvent,
  type PlayedPick,
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
      // From before the history: the day is all there is.
      at: '2024-11-09',
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

  it('puts a finish or a drop at the day the player chose, not when it was logged', () => {
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
    // Logged on the 17th: each sits at its own day, a day with no time of day.
    expect(entries.map((e) => [e.lines, e.day, e.at, e.rating])).toEqual([
      [[{ kind: 'dropped' }], '2026-11-12', '2026-11-12', null],
      [[{ kind: 'finished', rating: 9 }], '2026-11-10', '2026-11-10', 9],
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
    expect(entry.lines).toEqual([{ kind: 'dropped', rating: 3 }]);
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

  it('keeps a finish logged on its own day at the moment it was logged', () => {
    const [entry] = recentActivity([hades], null, [
      event(7, 'status', {
        status: ['playing', 'finished'],
        finished_at: [null, `${loggedOn}T00:00:00+00:00`],
      }),
    ]);
    expect(entry).toMatchObject({ lines: [{ kind: 'finished' }], day: loggedOn });
    // A moment, not only a day: it is as recent as it was logged.
    expect(entry.at).toContain('T');
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
      [7, ['unqueued']],
      [7, ['queued']],
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
    expect(entries.map((e) => [e.id, e.lines, e.day])).toEqual([
      [7, [{ kind: 'finished', rating: 9 }], '2026-11-10'],
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
  /** What the list shows: a game's updates folded into one, or a single row's kind. */
  const shown = (entries: ActivityEntry[]) =>
    entries.map((e) => (e.updates ? e.updates.map(kinds).flat() : kinds(e).join()));

  it('is a row each for two things done in a row', () => {
    const entries = recentActivity([hades], null, [started(11), queued(9)]);
    expect(shown(entries)).toEqual(['started', 'queued']);
    expect(entries.every((e) => e.lines.length === 1)).toBe(true);
  });

  it('is one row for more than two, its updates newest first, with the latest day and rating', () => {
    const entries = recentActivity([hades], null, [done(15), started(11), queued(9)]);
    expect(entries).toHaveLength(1);
    const [group] = entries;
    expect(group).toMatchObject({
      id: 7,
      name: 'Hades',
      day: toLocalIsoDate(new Date(at(15))),
      rating: 10,
    });
    expect(shown(entries)).toEqual([['finished', 'started', 'queued']]);
    // Each update is a row of its own, with its own day and rating.
    expect(group.updates!.map((one) => [one.id, one.rating])).toEqual([
      [7, 10],
      [7, null],
      [7, null],
    ]);
  });

  it('is separate rows when another game comes between', () => {
    const entries = recentActivity([hades, celeste], null, [
      queued(9),
      event(8, 'favorite', { favorite: [false, true] }, at(10)),
      started(11),
      done(12),
    ]);
    expect(entries.map((e) => [e.id, kinds(e).join()])).toEqual([
      [7, 'finished'],
      [7, 'started'],
      [8, 'favorite'],
      [7, 'queued'],
    ]);
  });

  it('stops a run when more than twelve hours pass between two things', () => {
    const entries = recentActivity([hades], null, [queued(5), started(6), done(19)]);
    // Thirteen hours from the start to the finish.
    expect(shown(entries)).toEqual(['finished', 'started', 'queued']);
  });

  it('goes on while each thing is within twelve hours of the last', () => {
    const entries = recentActivity([hades], null, [queued(6), started(12), done(18)]);
    expect(shown(entries)).toEqual([['finished', 'started', 'queued']]);
  });

  it("stops a run at midnight, so a group's updates are all on the day it shows under", () => {
    const entries = recentActivity([hades], null, [queued(21, 16), started(23, 16), done(1, 17)]);
    expect(entries.map((e) => [e.day, shown([e])[0]])).toEqual([
      [toLocalIsoDate(new Date(at(1, 17))), 'finished'],
      [toLocalIsoDate(new Date(at(23, 16))), 'started'],
      [toLocalIsoDate(new Date(at(21, 16))), 'queued'],
    ]);
  });

  it('adds up time played in a row, as one update', () => {
    const entries = recentActivity([hades], null, [
      event(7, 'playtime', { playtime_forever: [0, 60] }, at(9)),
      event(7, 'playtime', { playtime_forever: [60, 150] }, at(12)),
      event(7, 'edit', { rating: [null, 8] }, at(13)),
      event(7, 'playtime', { playtime_forever: [150, 180] }, at(14)),
    ]);
    expect(entries[0].updates!.map((one) => one.lines[0])).toEqual([
      { kind: 'played', minutes: 30 },
      { kind: 'rated', rating: 8 },
      { kind: 'played', minutes: 150 },
    ]);
  });

  it('gives each row the rating it came with', () => {
    const entries = recentActivity([hades], null, [
      done(9),
      event(7, 'edit', { rating: [10, 8] }, at(11)),
    ]);
    expect(entries.map((e) => [kinds(e).join(), e.rating])).toEqual([
      ['rated', 8],
      ['finished', 10],
    ]);
    expect(entries[1].lines[0].rating).toBe(10);
  });

  it('keeps each row its key as more is done to the game, and gives every row its own', () => {
    const first = [queued(9)];
    const [before] = recentActivity([hades], null, first);
    const after = recentActivity([hades], null, [...first, started(11)]);
    expect(after.at(-1)!.key).toBe(before.key);

    const entries = recentActivity([hades, celeste], null, [
      queued(9),
      event(8, 'favorite', { favorite: [false, true] }, at(10)),
      started(11),
    ]);
    expect(new Set(entries.map((e) => e.key)).size).toBe(3);

    const three = [queued(9), started(11), done(12)];
    const group = recentActivity([hades], null, three);
    const more = recentActivity([hades], null, [...three, queued(13)]);
    expect(more[0].key).toBe(group[0].key);
    expect(group[0].key).not.toBe(group[0].updates!.at(-1)!.key);
  });

  it("doesn't join what the game says with a line of the history from another day", () => {
    const entries = recentActivity([finished(7, '2026-03-01')], null, [queued(9)]);
    expect(entries.map(kinds)).toEqual([['queued'], ['finished']]);
  });
});

describe('recentActivity, a group of games', () => {
  const library = Array.from({ length: 8 }, (_, i) => game({ id: i + 1, name: `Game ${i + 1}` }));
  const wontPlay = (id: number, when: string) =>
    event(id, 'status', { status: ['backlog', 'wont_play'] }, when);
  const added = (id: number, when: string) =>
    event(id, 'added', { status: [null, 'backlog'] }, when);
  const moment = '2026-11-17T23:43:38.586384+00:00';
  /** What the list shows: a group's games, or a single row's kind. */
  const shown = (entries: ActivityEntry[]) =>
    entries.map((e) => (e.games ? e.games.map((one) => one.id) : `${e.id} ${kinds(e).join()}`));

  it('is one entry for more than three games in a row with the same thing done, newest first', () => {
    const entries = recentActivity(
      library,
      null,
      [1, 2, 3, 4].map((id) => wontPlay(id, moment)),
    );
    expect(entries).toHaveLength(1);
    const [group] = entries;
    expect(group).toMatchObject({
      name: '4 games',
      lines: [{ kind: 'wont_play' }],
      day: toLocalIsoDate(new Date(moment)),
      rating: null,
    });
    expect(group.games!.map((one) => one.id)).toEqual([4, 3, 2, 1]);
    // The first game's art.
    expect(group.id).toBe(4);
  });

  it('takes in a game moved the same way on its own, minutes apart', () => {
    // Games 1 to 3 at once, then game 4 a minute and a half before them.
    const entries = recentActivity(library, null, [
      wontPlay(4, '2026-11-17T23:42:04+00:00'),
      ...[1, 2, 3].map((id) => wontPlay(id, moment)),
    ]);
    expect(shown(entries)).toEqual([[3, 2, 1, 4]]);
  });

  it('is three rows for three games: it takes more than three', () => {
    const entries = recentActivity(
      library,
      null,
      [1, 2, 3].map((id) => wontPlay(id, moment)),
    );
    expect(shown(entries)).toEqual(['3 wont_play', '2 wont_play', '1 wont_play']);
  });

  it('leaves the games after it alone when they had something else done to them', () => {
    // Two games added, then four marked Won't Play.
    const entries = recentActivity(library, null, [
      added(5, at(10)),
      added(6, at(11)),
      ...[1, 2, 3, 4].map((id) => wontPlay(id, at(12))),
    ]);
    expect(shown(entries)).toEqual([[4, 3, 2, 1], '6 added', '5 added']);
  });

  it('groups the added ones too, once there are four of them', () => {
    const entries = recentActivity(library, null, [
      ...[5, 6, 7, 8].map((id, i) => added(id, at(8 + i))),
      ...[1, 2, 3, 4].map((id) => wontPlay(id, at(12))),
    ]);
    expect(shown(entries)).toEqual([
      [4, 3, 2, 1],
      [8, 7, 6, 5],
    ]);
  });

  it("isn't broken off by nothing: another game in between ends it", () => {
    const entries = recentActivity(library, null, [
      ...[1, 2].map((id) => wontPlay(id, at(9))),
      added(5, at(10)),
      ...[3, 4].map((id) => wontPlay(id, at(11))),
    ]);
    expect(shown(entries)).toEqual([
      '4 wont_play',
      '3 wont_play',
      '5 added',
      '2 wont_play',
      '1 wont_play',
    ]);
  });

  it("doesn't reach across days", () => {
    const entries = recentActivity(library, null, [
      ...[1, 2].map((id) => wontPlay(id, at(12, 16))),
      ...[3, 4].map((id) => wontPlay(id, at(12, 17))),
    ]);
    expect(entries.every((e) => !e.games)).toBe(true);
    expect(entries).toHaveLength(4);
  });

  it('leaves out a game with more done to it in a row: that is more than one thing done', () => {
    const entries = recentActivity(library, null, [
      event(1, 'queue', { queued: [false, true] }, '2026-11-17T23:40:00+00:00'),
      ...[1, 2, 3, 4, 5].map((id) => wontPlay(id, moment)),
    ]);
    // Game 1 was queued minutes before, so its two things stay rows of their own.
    expect(shown(entries)).toEqual([[5, 4, 3, 2], '1 wont_play', '1 queued']);
  });

  it('never groups lines that each say something of their own: time played, a move, a rating', () => {
    const entries = recentActivity(library, null, [
      ...[1, 2, 3, 4].map((id) =>
        event(id, 'playtime', { playtime_forever: [0, 60 * id] }, at(10)),
      ),
      ...[5, 6, 7, 8].map((id) => event(id, 'edit', { rating: [null, 8] }, at(11))),
    ]);
    expect(entries.every((e) => !e.games)).toBe(true);
    expect(entries).toHaveLength(8);
  });

  it('never groups finishes the player dated to another day: each sits at its own', () => {
    const finish = (id: number, day: string) =>
      event(
        id,
        'status',
        { status: ['playing', 'finished'], finished_at: [null, `${day}T00:00:00+00:00`] },
        at(12),
      );
    const same = recentActivity(
      library,
      null,
      [1, 2, 3, 4].map((id) => finish(id, '2026-11-10')),
    );
    expect(same.every((e) => !e.games)).toBe(true);
    expect(same.map((e) => e.at)).toEqual(Array(4).fill('2026-11-10'));

    const mixed = recentActivity(library, null, [
      ...[1, 2, 3].map((id) => finish(id, '2026-11-10')),
      finish(4, '2026-11-11'),
    ]);
    expect(mixed.map((e) => e.at)).toEqual([
      '2026-11-11',
      '2026-11-10',
      '2026-11-10',
      '2026-11-10',
    ]);
  });

  it('counts as one of the fifty', () => {
    const many = Array.from({ length: 60 }, (_, i) => game({ id: i + 1 }));
    const entries = recentActivity(many, null, [
      ...many.slice(0, 10).map((one) => wontPlay(one.id, moment)),
      // Fifty more, each its own row: every other one a different thing.
      ...many
        .slice(10)
        .map((one, i) =>
          i % 2
            ? event(
                one.id,
                'queue',
                { queued: [false, true] },
                `2026-11-16T10:${String(i).padStart(2, '0')}:00+00:00`,
              )
            : event(
                one.id,
                'favorite',
                { favorite: [false, true] },
                `2026-11-16T10:${String(i).padStart(2, '0')}:00+00:00`,
              ),
        ),
    ]);
    expect(entries).toHaveLength(RECENT_ACTIVITY);
    expect(entries[0].games).toHaveLength(10);
  });

  it('is never made of what the games say about a time before the history', () => {
    const before = [1, 2, 3, 4].map((id) => finished(id, '2026-03-01'));
    const entries = recentActivity(before, null);
    expect(entries.every((e) => !e.games)).toBe(true);
    expect(entries).toHaveLength(4);
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

describe('recentActivity, for other people (the highlights)', () => {
  const feed = (games: Parameters<typeof recentActivity>[0], events: ActivityEvent[]) =>
    recentActivity(games, null, events, { only: HIGHLIGHTS });

  it('keeps what was played, finished, dropped, rated and made a favorite', () => {
    const playingNow = game({ id: 9, name: 'Tunic', status: 'playing' });
    const entries = feed(
      [hades, celeste, playingNow],
      [
        event(7, 'status', { status: ['playing', 'finished'], rating: [null, 9] }, at(9)),
        event(8, 'status', { status: ['playing', 'dropped'] }, at(10)),
        event(7, 'edit', { rating: [9, 10] }, at(11, 18)),
        event(8, 'favorite', { favorite: [false, true] }, at(12, 18)),
        event(9, 'status', { status: ['backlog', 'playing'] }, at(13, 18)),
        event(9, 'playtime', { playtime_forever: [0, 90] }, at(14, 19)),
      ],
    );
    expect(entries.map((e) => [e.name, kinds(e)])).toEqual([
      ['Tunic', ['played']],
      ['Tunic', ['playing']],
      ['Celeste', ['favorite']],
      ['Hades', ['rated']],
      ['Celeste', ['dropped']],
      ['Hades', ['finished']],
    ]);
  });

  it("leaves out the housekeeping, as if it never happened: it doesn't part a game's rows either", () => {
    const entries = feed(
      [hades, celeste],
      [
        event(7, 'status', { status: ['backlog', 'playing'] }, at(9)),
        event(7, 'playtime', { playtime_forever: [0, 90] }, at(10)),
        // Between Hades's lines, and gone: they are still one run, one row.
        event(8, 'added', { status: [null, 'backlog'] }, at(10)),
        event(8, 'queue', { queued: [false, true] }, at(10)),
        event(8, 'queue', { queued: [true, false] }, at(10)),
        event(8, 'status', { status: ['backlog', 'wont_play'] }, at(10)),
        event(8, 'edit', { platform: ['PC', 'Switch'] }, at(10)),
        event(8, 'favorite', { favorite: [true, false] }, at(10)),
        event(8, 'note', { noted: [false, true] }, at(10)),
        event(7, 'status', { status: ['playing', 'finished'] }, at(11)),
      ],
    );
    expect(entries.map((e) => [e.name, kinds(e)])).toEqual([
      ['Hades', ['started', 'played', 'finished']],
    ]);
  });

  it('keeps what is in the past in the past: a finish dated two years back sits under what was done since', () => {
    const entries = feed(
      [hades, celeste],
      [
        event(8, 'favorite', { favorite: [false, true] }, at(9)),
        // Logged later the same day, about a finish in 2024.
        event(
          7,
          'status',
          {
            status: ['backlog', 'finished'],
            finished_at: [null, '2024-05-01T00:00:00+00:00'],
            rating: [null, 8],
          },
          at(12),
        ),
      ],
    );
    expect(entries.map((e) => [e.name, kinds(e), e.at])).toEqual([
      ['Celeste', ['favorite'], at(9)],
      ['Hades', ['finished'], '2024-05-01'],
    ]);
  });

  it('says when each row happened, for "2h ago"', () => {
    const entries = feed(
      [hades, finished(1, '2025-08-20')],
      [event(7, 'status', { status: ['backlog', 'playing'] }, at(9))],
    );
    // A moment from the history; a day for a finish from before it.
    expect(entries.map((e) => e.at)).toEqual([at(9), '2025-08-20']);
  });
});

describe('activityAgo', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it.each([
    [20_000, 'Just now'],
    [MINUTE, '1m ago'],
    [59 * MINUTE, '59m ago'],
    [HOUR, '1h ago'],
    [23 * HOUR + 59 * MINUTE, '23h ago'],
    [DAY, '1d ago'],
    [6 * DAY + 23 * HOUR, '6d ago'],
  ])('says %i ms ago as "%s"', (ms, said) => {
    expect(activityAgo(ago(ms), now)).toBe(said);
  });

  it('says the day once it is a week old, with the year for another year', () => {
    expect(activityAgo('2026-11-10T20:00:00+00:00', now)).toBe('Nov 10');
    expect(activityAgo('2025-08-20T20:00:00+00:00', now)).toBe('Aug 20, 2025');
  });

  it('says a day alone as today or so many days ago within the week, then as the day it was', () => {
    expect(activityAgo('2026-11-19', now)).toBe('Today');
    expect(activityAgo('2026-11-18', now)).toBe('1d ago');
    expect(activityAgo('2026-11-13', now)).toBe('6d ago');
    expect(activityAgo('2026-11-12', now)).toBe('Nov 12');
    expect(activityAgo('2022-08-20', now)).toBe('Aug 20, 2022');
    // A day still to come is said as it is.
    expect(activityAgo('2026-11-25', now)).toBe('Nov 25');
  });

  it('says nothing when nothing says when', () => {
    expect(activityAgo('', now)).toBe('');
    expect(activityAgo('not a date at all', now)).toBe('');
  });
});

describe('recentActivity, a start that came from a pick', () => {
  const start = (gameId: number, when: string) =>
    event(gameId, 'status', { status: ['backlog', 'playing'] }, when);
  const pick = (gameId: number, kind: PlayedPick['kind'], when: string): PlayedPick => ({
    game_id: gameId,
    kind,
    answered_at: when,
  });

  it('says Random or Pick My Game picked it, from Play pressed as it was logged', () => {
    // Newest first.
    const [asked, rolled] = recentActivity(
      [hades, celeste],
      null,
      [start(7, at(20)), start(8, at(21))],
      {
        picks: [
          pick(7, 'random', '2026-11-17T20:00:02+00:00'),
          // Either can be saved first.
          pick(8, 'questions', '2026-11-17T20:59:58+00:00'),
        ],
      },
    );
    expect(asked.lines).toEqual([{ kind: 'started', pickedBy: 'questions' }]);
    expect(rolled.lines).toEqual([{ kind: 'started', pickedBy: 'random' }]);
  });

  it('says nothing of a pick for another game, or one pressed long before the start', () => {
    const [entry] = recentActivity([hades, celeste], null, [start(7, at(20))], {
      picks: [pick(8, 'random', at(20)), pick(7, 'random', at(19))],
    });
    expect(entry.lines).toEqual([{ kind: 'started' }]);
  });

  it('keeps saying so for the game being played now', () => {
    const playing = game({ id: 7, name: 'Hades', status: 'playing' });
    const [entry] = recentActivity([playing], { id: 7, started_at: at(20) }, [start(7, at(20))], {
      picks: [pick(7, 'questions', at(20))],
    });
    expect(entry.lines).toEqual([{ kind: 'playing', pickedBy: 'questions' }]);
  });

  it('only says it of a start: a pick queued and played later was the queue', () => {
    const [entry] = recentActivity(
      [hades],
      null,
      [event(7, 'queue', { queued: [false, true] }, at(20))],
      { picks: [pick(7, 'random', at(20))] },
    );
    expect(entry.lines).toEqual([{ kind: 'queued' }]);
  });
});

describe('recentActivity, an event that took more than one change', () => {
  it('sits at its last change: a game taken off the queue and started within the minute is the newest', () => {
    const unqueued = (gameId: number, when: string) =>
      event(gameId, 'queue', { queued: [true, false] }, when);
    const entries = recentActivity([hades, celeste], null, [
      // Off the queue at 20:00:00, then started 50 seconds later: one event.
      {
        ...event(
          7,
          'status',
          { queued: [true, false], status: ['backlog', 'playing'] },
          '2026-11-17T20:00:00+00:00',
        ),
        updated_at: '2026-11-17T20:00:50+00:00',
      },
      unqueued(8, '2026-11-17T20:00:05+00:00'),
    ]);
    expect(entries.map((entry) => [entry.name, kinds(entry), entry.at])).toEqual([
      ['Hades', ['started'], '2026-11-17T20:00:50+00:00'],
      ['Celeste', ['unqueued'], '2026-11-17T20:00:05+00:00'],
    ]);
  });
});

describe('recentActivity, a rating', () => {
  it('is a rating given, or a change of one the game already had', () => {
    const [changed, given] = recentActivity([hades, celeste], null, [
      event(7, 'edit', { rating: [null, 9] }, at(20)),
      event(8, 'edit', { rating: [6, 8] }, at(21)),
    ]);
    expect(changed.lines).toEqual([{ kind: 'rated', rating: 8, changed: true }]);
    expect(given.lines).toEqual([{ kind: 'rated', rating: 9 }]);
  });
});

describe("recentActivity, where the player's time zone is not known (what other people see)", () => {
  // Noon here, so the day it was logged is the 20th wherever this runs.
  const loggedAt = new Date(2026, 10, 20, 12).toISOString();
  const finish = (day: string) =>
    event(
      7,
      'status',
      {
        status: ['playing', 'finished'],
        finished_at: [null, `${day}T00:00:00+00:00`],
        rating: [null, 9],
      },
      loggedAt,
    );
  const finishedHades = (day: string) =>
    game({
      id: 7,
      name: 'Hades',
      status: 'finished',
      rating: 9,
      finished_at: `${day}T00:00:00+00:00`,
    });

  it('takes a finish dated the day before or after it was logged as logged that day: it was, in their zone', () => {
    for (const day of ['2026-11-19', '2026-11-20', '2026-11-21']) {
      const [entry, ...rest] = recentActivity([finishedHades(day)], null, [finish(day)], {
        zoneKnown: false,
      });
      // At the moment it was logged, not as a day in the past; on their own day.
      expect([entry.at, entry.day]).toEqual([loggedAt, day]);
      // And said once: the game's own finish isn't listed beside it.
      expect(rest).toEqual([]);
    }
  });

  it('still keeps a finish from further back in the past', () => {
    const [entry] = recentActivity([finishedHades('2026-11-17')], null, [finish('2026-11-17')], {
      zoneKnown: false,
    });
    expect([entry.at, entry.day]).toEqual(['2026-11-17', '2026-11-17']);
  });

  it('goes by the exact day where the zone is known: yesterday is in the past', () => {
    const [entry] = recentActivity([finishedHades('2026-11-19')], null, [finish('2026-11-19')]);
    expect([entry.at, entry.day]).toEqual(['2026-11-19', '2026-11-19']);
  });
});

describe('recentActivity, a pick and the starts around it', () => {
  const start = (id: number, when: string) => ({
    ...event(7, 'status', { status: ['backlog', 'playing'] }, when),
    id,
  });
  const back = (id: number, when: string) => ({
    ...event(7, 'status', { status: ['playing', 'backlog'] }, when),
    id,
  });

  it('labels the one start it made: the same game started again by hand soon after says nothing', () => {
    const entries = recentActivity(
      [hades],
      null,
      [
        start(903, '2026-11-17T20:01:30+00:00'),
        back(902, '2026-11-17T20:01:10+00:00'),
        start(901, '2026-11-17T20:00:03+00:00'),
      ],
      { picks: [{ game_id: 7, kind: 'random', answered_at: '2026-11-17T20:00:00+00:00' }] },
    );
    const lines = entries.flatMap((entry) => entry.updates ?? [entry]).map((one) => one.lines[0]);
    expect(lines).toEqual([
      { kind: 'started' },
      { kind: 'backlog' },
      { kind: 'started', pickedBy: 'random' },
    ]);
  });

  it('says nothing of a start logged minutes after Play was pressed', () => {
    const [entry] = recentActivity([hades], null, [start(901, '2026-11-17T20:05:00+00:00')], {
      picks: [{ game_id: 7, kind: 'random', answered_at: '2026-11-17T20:00:00+00:00' }],
    });
    expect(entry.lines).toEqual([{ kind: 'started' }]);
  });
});

describe('recentActivity, an event changed again much later (a late Undo)', () => {
  it('stays where it was: only a change within the sitting moves when it happened', () => {
    const added = (updated_at: string) => ({
      ...event(7, 'added', { status: [null, 'backlog'] }, '2026-11-17T15:00:00+00:00'),
      updated_at,
    });
    const [soon] = recentActivity([hades], null, [added('2026-11-17T15:00:40+00:00')]);
    expect(soon.at).toBe('2026-11-17T15:00:40+00:00');

    // An Undo from a toast that waited twenty minutes.
    const [late] = recentActivity([hades], null, [added('2026-11-17T15:20:00+00:00')]);
    expect(late.at).toBe('2026-11-17T15:00:00+00:00');
  });
});
