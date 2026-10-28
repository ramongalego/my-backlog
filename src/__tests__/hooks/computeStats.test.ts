import { computeStats } from '@/hooks/useStats';
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
