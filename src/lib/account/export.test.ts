import {
  buildExport,
  exportFileName,
  gamesCsv,
  type ExportGameRow,
  type ExportRows,
} from '@/lib/account/export';

const game = (over: Partial<ExportGameRow> & { id: number; name: string }): ExportGameRow => ({
  source: 'steam',
  platform: null,
  app_id: 1000 + over.id,
  steam_app_id: null,
  status: 'backlog',
  rating: null,
  notes: null,
  started_at: null,
  finished_at: null,
  dropped_at: null,
  playtime_forever: 0,
  last_played_at: null,
  created_at: '2026-01-26T10:00:00Z',
  header_image: 'https://cdn/art.jpg',
  art_chosen: false,
  ...over,
});

const rows = (over: Partial<ExportRows> = {}): ExportRows => ({
  account: {
    email: 'player@example.com',
    createdAt: '2026-01-26T09:00:00Z',
    displayName: 'mistkai',
    steamId: '7656',
    steamUsername: 'Ankrath',
  },
  games: [],
  queue: [],
  favorites: [],
  insights: [],
  sharePages: [],
  supportMessages: [],
  history: [],
  picks: [],
  ...over,
});

const NOW = new Date('2026-11-16T15:30:00Z');

describe('buildExport', () => {
  it('says what it is, when it was made, and whose it is', () => {
    const data = buildExport(rows(), NOW);
    expect(data).toMatchObject({
      app: 'MyBacklog',
      version: 1,
      exportedAt: '2026-11-16T15:30:00.000Z',
      account: {
        email: 'player@example.com',
        name: 'mistkai',
        memberSince: '2026-01-26T09:00:00Z',
        steam: { id: '7656', username: 'Ankrath' },
      },
    });
  });

  it('has no Steam account for a player who never connected one', () => {
    const data = buildExport(
      rows({ account: { ...rows().account, steamId: null, steamUsername: null } }),
      NOW,
    );
    expect(data.account.steam).toBeNull();
  });

  it('gives a game what was logged on it, with its dates as days', () => {
    const [hades] = buildExport(
      rows({
        games: [
          game({
            id: 1,
            name: 'Hades',
            status: 'finished',
            rating: 9,
            notes: 'One more run',
            started_at: '2026-03-01T18:22:10Z',
            finished_at: '2026-03-20T00:00:00Z',
            playtime_forever: 1230,
            last_played_at: '2026-03-20T21:00:00Z',
          }),
        ],
      }),
      NOW,
    ).games;
    expect(hades).toEqual({
      id: 1,
      name: 'Hades',
      // A Steam game played on Steam.
      platform: 'PC',
      source: 'steam',
      steamAppId: 1001,
      status: 'finished',
      rating: 9,
      notes: 'One more run',
      startedAt: '2026-03-01T18:22:10Z',
      finishedOn: '2026-03-20',
      droppedOn: null,
      playtimeMinutes: 1230,
      lastPlayedAt: '2026-03-20T21:00:00Z',
      addedAt: '2026-01-26T10:00:00Z',
      queuePosition: null,
      favoritePosition: null,
      chosenArt: null,
    });
  });

  it('keeps a game added by hand its console, its Steam page and the art picked for it', () => {
    const [aria] = buildExport(
      rows({
        games: [
          game({
            id: 2,
            name: 'Castlevania: Aria of Sorrow',
            source: 'manual',
            platform: 'GBA',
            app_id: null,
            steam_app_id: 1515950,
            art_chosen: true,
            header_image: 'https://cdn/picked.jpg',
          }),
        ],
      }),
      NOW,
    ).games;
    expect(aria).toMatchObject({
      platform: 'GBA',
      source: 'manual',
      steamAppId: 1515950,
      chosenArt: 'https://cdn/picked.jpg',
    });
  });

  it("numbers the queue and the favorites from 1, in the player's order", () => {
    const { games } = buildExport(
      rows({
        games: [game({ id: 1, name: 'A' }), game({ id: 2, name: 'B' }), game({ id: 3, name: 'C' })],
        // Positions as saved: any numbers, in any order.
        queue: [
          { game_id: 3, position: 7 },
          { game_id: 1, position: 2 },
        ],
        favorites: [{ game_id: 2, position: 0 }],
      }),
      NOW,
    );
    expect(games.map((g) => [g.name, g.queuePosition, g.favoritePosition])).toEqual([
      ['A', 1, null],
      ['B', null, 1],
      ['C', 2, null],
    ]);
  });

  it('carries the written profile, the share pages and the messages sent to support', () => {
    const data = buildExport(
      rows({
        insights: [
          {
            tone: 'roast',
            headline: 'A backlog with a library attached',
            paragraphs: ['One.', 'Two.'],
            signature: 'Yours',
            generated_at: '2026-10-01T10:00:00Z',
          },
        ],
        sharePages: [
          {
            id: 'abc123',
            game_name: 'Hades',
            rating: 9,
            playtime_minutes: 1230,
            created_at: '2026-03-20T22:00:00Z',
          },
        ],
        supportMessages: [
          { type: 'bug', message: 'The queue jumped', created_at: '2026-04-01T08:00:00Z' },
        ],
      }),
      NOW,
    );
    expect(data.insights).toEqual([
      {
        kind: 'roast',
        headline: 'A backlog with a library attached',
        paragraphs: ['One.', 'Two.'],
        signature: 'Yours',
        writtenAt: '2026-10-01T10:00:00Z',
      },
    ]);
    expect(data.sharePages).toEqual([
      {
        id: 'abc123',
        game: 'Hades',
        rating: 9,
        playtimeMinutes: 1230,
        createdAt: '2026-03-20T22:00:00Z',
      },
    ]);
    expect(data.supportMessages).toEqual([
      { type: 'bug', message: 'The queue jumped', sentAt: '2026-04-01T08:00:00Z' },
    ]);
  });

  it('includes the history of changes to the games in the file, as it was recorded', () => {
    const finished = { status: ['playing', 'finished'], rating: [null, 9] };
    const data = buildExport(
      rows({
        games: [game({ id: 7, name: 'Hades' })],
        history: [
          { game_id: 7, kind: 'status', changes: finished, created_at: '2026-11-17T21:00:00Z' },
          {
            game_id: 7,
            kind: 'playtime',
            changes: { playtime_forever: [600, 660] },
            created_at: '2026-11-18T09:00:00Z',
          },
          // A tool Steam counts as owned: its hours change too, but it isn't in the file.
          {
            game_id: 99,
            kind: 'playtime',
            changes: { playtime_forever: [0, 30] },
            created_at: '2026-11-18T10:00:00Z',
          },
        ],
      }),
      NOW,
    );
    expect(data.history).toEqual([
      { gameId: 7, kind: 'status', changes: finished, at: '2026-11-17T21:00:00Z' },
      {
        gameId: 7,
        kind: 'playtime',
        changes: { playtime_forever: [600, 660] },
        at: '2026-11-18T09:00:00Z',
      },
    ]);
  });

  it('includes what Pick My Game and Random picked, with the answers and what was done with it', () => {
    const fromQuestions = {
      game_id: 7,
      kind: 'questions',
      mode: 'play',
      mood: 'relaxed',
      energy: 'low',
      time: 'short',
      attempt: 2,
      reasoning: 'Short and gentle.',
      model: 'a-model',
      outcome: 'played',
      created_at: '2026-11-17T21:00:00Z',
      answered_at: '2026-11-17T21:00:09Z',
    };
    const atRandom = {
      game_id: 7,
      kind: 'random',
      mode: 'queue',
      mood: null,
      energy: null,
      time: null,
      attempt: 1,
      reasoning: null,
      model: null,
      outcome: null,
      created_at: '2026-11-18T09:00:00Z',
      answered_at: null,
    };
    const data = buildExport(
      rows({
        games: [game({ id: 7, name: 'Hades' })],
        // The last is of a game that isn't in the file.
        picks: [fromQuestions, atRandom, { ...atRandom, game_id: 99 }],
      }),
      NOW,
    );
    expect(data.picks).toEqual([
      {
        gameId: 7,
        kind: 'questions',
        for: 'play',
        mood: 'relaxed',
        energy: 'low',
        time: 'short',
        attempt: 2,
        reason: 'Short and gentle.',
        model: 'a-model',
        outcome: 'played',
        at: '2026-11-17T21:00:00Z',
        answeredAt: '2026-11-17T21:00:09Z',
      },
      {
        gameId: 7,
        kind: 'random',
        for: 'queue',
        mood: null,
        energy: null,
        time: null,
        attempt: 1,
        reason: null,
        model: null,
        outcome: null,
        at: '2026-11-18T09:00:00Z',
        answeredAt: null,
      },
    ]);
  });

  it('has an empty history for a library nothing has happened in yet', () => {
    expect(buildExport(rows({ games: [game({ id: 7, name: 'Hades' })] }), NOW).history).toEqual([]);
  });
});

describe('gamesCsv', () => {
  const csvOf = (games: ExportGameRow[], extra: Partial<ExportRows> = {}) =>
    gamesCsv(buildExport(rows({ games, ...extra }), NOW).games);
  /** The rows under the header, without the mark the file starts with. */
  const lines = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n');

  it('is a header and a row a game, by name, as a spreadsheet reads it', () => {
    const csv = csvOf(
      [
        game({ id: 2, name: 'Hades', status: 'finished', rating: 9, playtime_forever: 1230 }),
        game({ id: 1, name: 'Celeste', status: 'wont_play' }),
      ],
      { queue: [{ game_id: 1, position: 0 }], favorites: [{ game_id: 2, position: 0 }] },
    );
    expect(lines(csv)).toEqual([
      'Name,Platform,Status,Rating,Notes,Started,Finished,Dropped,Hours played,Last played,Added,Queue position,Favorite,Source,Steam app ID',
      "Celeste,PC,Won't Play,,,,,,0,,2026-01-26,1,,Steam,1001",
      'Hades,PC,Finished,9,,,,,20.5,,2026-01-26,,1,Steam,1002',
    ]);
  });

  it('starts with a byte order mark and ends its lines with CRLF, for Excel', () => {
    const csv = csvOf([game({ id: 1, name: 'ポケモン' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).toContain('ポケモン');
  });

  it('quotes a cell with a comma, a quote or a line break in it', () => {
    // The note's own line break is a bare one, so the row stays one piece here.
    const [, row] = lines(
      csvOf([
        game({
          id: 1,
          name: 'Warhammer 40,000: Rogue Trader',
          status: 'dropped',
          notes: 'Said "one more turn".\nIt was not one.',
          dropped_at: '2026-05-02T00:00:00Z',
        }),
      ]),
    );
    expect(row).toContain('"Warhammer 40,000: Rogue Trader",PC,Dropped,,');
    expect(row).toContain('"Said ""one more turn"".\nIt was not one."');
    expect(row).toContain(',2026-05-02,');
  });

  it('keeps a spreadsheet from running a name or a note as a formula', () => {
    const csv = csvOf([
      game({ id: 1, name: '=HYPERLINK("http://evil","Hades")', notes: '+1 would play again' }),
      game({ id: 2, name: '-KLAUS-', notes: '@everyone play this' }),
    ]);
    const [, klaus, link] = lines(csv);
    expect(klaus.startsWith("'-KLAUS-,")).toBe(true);
    expect(klaus).toContain(",'@everyone play this,");
    expect(link.startsWith(`"'=HYPERLINK(""http://evil"",""Hades"")",`)).toBe(true);
    expect(link).toContain(",'+1 would play again,");
    // A number is a number: a rating of 9 isn't text.
    expect(csvOf([game({ id: 3, name: 'A', rating: 9, status: 'finished' })])).toContain(
      ',Finished,9,',
    );
  });
});

it('names the file for what it is and the day it was made', () => {
  expect(exportFileName('csv', NOW)).toBe('mybacklog-games-2026-11-16.csv');
  expect(exportFileName('json', NOW)).toBe('mybacklog-data-2026-11-16.json');
});
