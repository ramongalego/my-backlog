import { computeStats } from '@/hooks/useStatsPage';
import type { GameItem } from '@/lib/data/loaders';

let nextId = 1;
const game = (overrides: Partial<GameItem> = {}): GameItem =>
  ({
    id: nextId++,
    name: `Game ${nextId}`,
    status: 'backlog',
    playtime_forever: 0,
    main_story_hours: null,
    tags: null,
    rating: null,
    finished_at: null,
    header_image: null,
    release_date: null,
    ...overrides,
  }) as GameItem;

const stats = (games: GameItem[]) => computeStats(games, {}, new Set())!;

describe('mostPlayed', () => {
  it('lists the five most played games, most first, in whole hours', () => {
    const games = [10, 300, 50, 600, 200, 120, 0].map((hours) =>
      game({ name: `${hours}h`, playtime_forever: hours * 60 }),
    );
    expect(stats(games).mostPlayed.map((g) => g.name)).toEqual([
      '600h',
      '300h',
      '200h',
      '120h',
      '50h',
    ]);
    expect(stats(games).mostPlayed[0].hours).toBe(600);
  });

  it('leaves out games played for under an hour', () => {
    expect(stats([game({ playtime_forever: 59 })]).mostPlayed).toEqual([]);
  });
});

describe('favourites', () => {
  const finished = (rating: number, finished_at = '2025-01-01') =>
    game({ name: `${rating} on ${finished_at}`, status: 'finished', rating, finished_at });

  it('shows 9s and 10s, best then newest first', () => {
    const games = [finished(9, '2024-01-01'), finished(10), finished(9, '2025-06-01'), finished(8)];
    expect(stats(games).favourites.map((g) => g.name)).toEqual([
      '10 on 2025-01-01',
      '9 on 2025-06-01',
      '9 on 2024-01-01',
    ]);
  });

  it('takes 8s too when there are fewer than three 9s and 10s', () => {
    const names = stats([finished(9), finished(8), finished(7)]).favourites.map((g) => g.rating);
    expect(names).toEqual([9, 8]);
  });

  it("doesn't count ratings on games that aren't finished", () => {
    expect(stats([game({ status: 'dropped', rating: 10 })]).favourites).toEqual([]);
  });
});

describe('finishContrast', () => {
  const tagged = (tag: string, total: number, finishedCount: number) =>
    Array.from({ length: total }, (_, i) =>
      game({ tags: [tag], status: i < finishedCount ? 'finished' : 'backlog' }),
    );

  it('names the tags you finish most and least', () => {
    const { finishContrast } = stats([
      ...tagged('Strategy', 10, 8),
      ...tagged('Action', 10, 2),
      ...tagged('RPG', 10, 5),
    ]);
    expect(finishContrast?.high).toMatchObject({ tag: 'Strategy', pct: 80 });
    expect(finishContrast?.low).toMatchObject({ tag: 'Action', pct: 20 });
  });

  it('ignores tags with too few games to say much', () => {
    const { finishContrast } = stats([...tagged('Strategy', 10, 8), ...tagged('Kids', 7, 7)]);
    expect(finishContrast).toBeNull();
  });

  it('is null when the rates are close', () => {
    expect(stats([...tagged('A', 10, 5), ...tagged('B', 10, 4)]).finishContrast).toBeNull();
  });
});

describe('gamesByReleaseYear', () => {
  it("counts games by the year they came out, leaving out ones that aren't out yet", () => {
    const nextYear = new Date().getFullYear() + 1;
    const games = [
      game({ release_date: 'Sep 28, 2010' }),
      game({ release_date: '28 Sep, 2010' }),
      game({ release_date: 'Mar 3, 2017' }),
      game({ release_date: `Jan 28, ${nextYear}` }),
      game({ release_date: String(nextYear) }),
      game({ release_date: 'To be announced' }),
    ];
    expect(stats(games).gamesByReleaseYear).toEqual([
      { year: '2010', count: 2 },
      { year: '2017', count: 1 },
    ]);
  });
});

describe('topTags and tagCompletion', () => {
  it('leave out tags that say how a game is played, not what it is', () => {
    const games = [
      game({ tags: ['Singleplayer', 'Multiplayer', 'RPG'] }),
      game({ tags: ['Single-player', 'Multi-player', 'Quick-Time Events', 'Reboot', 'RPG'] }),
      game({ tags: ['RPG'], status: 'finished' }),
    ];
    const { topTags, tagCompletion } = stats(games);
    expect(topTags).toEqual([{ tag: 'RPG', count: 3 }]);
    expect(tagCompletion.map((t) => t.tag)).toEqual(['RPG']);
  });

  it('count finished games per tag, for tags on at least three games', () => {
    const games = [
      ...['finished', 'finished', 'backlog', 'backlog'].map((status) =>
        game({ status, tags: ['Metroidvania'] }),
      ),
      game({ status: 'finished', tags: ['Puzzle'] }),
      game({ status: 'finished', tags: ['Puzzle'] }),
    ];
    expect(stats(games).tagCompletion).toEqual([
      { tag: 'Metroidvania', total: 4, finished: 2, pct: 50 },
    ]);
  });
});

describe('ratingDistribution', () => {
  it('has a bar for every rating from 0 to 10, from finished games only', () => {
    const games = [
      game({ status: 'finished', rating: 9 }),
      game({ status: 'finished', rating: 9 }),
      game({ status: 'finished', rating: 6 }),
      // Not finished: its rating doesn't count.
      game({ status: 'dropped', rating: 2 }),
    ];
    const bars = stats(games).ratingDistribution;
    expect(bars.map((b) => b.rating)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(bars.filter((b) => b.count > 0)).toEqual([
      { rating: 6, count: 1 },
      { rating: 9, count: 2 },
    ]);
  });
});
