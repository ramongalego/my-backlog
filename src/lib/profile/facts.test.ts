import { factsSignature, hasEnoughForProfile, playerFacts } from '@/lib/profile/facts';
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

const many = (n: number, overrides: Partial<GameItem>) =>
  Array.from({ length: n }, () => game(overrides));

describe('hasEnoughForProfile', () => {
  it('is false for a new library', () => {
    expect(hasEnoughForProfile([])).toBe(false);
    expect(hasEnoughForProfile(many(40, {}))).toBe(false);
  });

  it('is true with five games finished or dropped, three of them rated', () => {
    const games = [
      ...many(3, { status: 'finished', rating: 8 }),
      ...many(2, { status: 'dropped' }),
    ];
    expect(hasEnoughForProfile(games)).toBe(true);
  });

  it('is false with five ended but fewer than three rated', () => {
    const games = [
      ...many(2, { status: 'finished', rating: 8 }),
      ...many(3, { status: 'dropped' }),
    ];
    expect(hasEnoughForProfile(games)).toBe(false);
  });

  it('is true for a Steam library with ten games played for two hours or more', () => {
    expect(hasEnoughForProfile(many(10, { playtime_forever: 120 }))).toBe(true);
    expect(hasEnoughForProfile(many(10, { playtime_forever: 119 }))).toBe(false);
  });

  it("doesn't count games the player won't play", () => {
    const games = [
      ...many(9, { playtime_forever: 600 }),
      game({ status: 'wont_play', playtime_forever: 600 }),
    ];
    expect(hasEnoughForProfile(games)).toBe(false);
  });
});

describe('playerFacts', () => {
  it('is null for an empty library', () => {
    expect(playerFacts([])).toBeNull();
  });

  it('works out the finish rate, the games dropped late and early, and the backlog', () => {
    const facts = playerFacts([
      game({ name: 'Hades', status: 'finished', rating: 10, playtime_forever: 80 * 60 }),
      game({ name: 'Celeste', status: 'finished', rating: 9, playtime_forever: 20 * 60 }),
      game({ name: 'Elden Ring', status: 'finished', rating: 5, playtime_forever: 120 * 60 }),
      game({ name: 'Starfield', status: 'dropped', playtime_forever: 30 * 60 }),
      game({ name: 'Tiny Thing', status: 'dropped', playtime_forever: 30 }),
      game({ name: 'Persona 5', status: 'backlog', playtime_forever: 12 * 60 }),
      game({ name: 'Untouched', status: 'backlog' }),
      game({ name: 'Nope', status: 'wont_play' }),
    ])!;

    expect(facts.finished).toBe(3);
    expect(facts.dropped).toBe(2);
    expect(facts.finishRatePct).toBe(60);
    expect(facts.droppedLate).toEqual([{ name: 'Starfield', hours: 30 }]);
    expect(facts.droppedEarly).toBe(1);
    expect(facts.startedNotFinished).toEqual([{ name: 'Persona 5', hours: 12 }]);
    expect(facts.backlog.neverStarted).toBe(1);
    expect(facts.ratings.count).toBe(3);
    expect(facts.ratings.lowest).toEqual([{ name: 'Elden Ring', rating: 5 }]);
    expect(facts.wontPlay).toBe(1);
    expect(facts.mostPlayed[0]).toEqual({ name: 'Elden Ring', hours: 120 });
  });
});

describe('factsSignature', () => {
  const library = () => [
    ...many(3, { status: 'finished', rating: 8, playtime_forever: 600 }),
    ...many(2, { status: 'dropped', playtime_forever: 60 }),
  ];

  it('stays the same when only hours played change', () => {
    const before = library();
    const after = before.map((g) => ({ ...g, playtime_forever: g.playtime_forever + 90 }));
    expect(factsSignature(playerFacts(after)!)).toBe(factsSignature(playerFacts(before)!));
  });

  it('changes when a game is finished or rated', () => {
    const before = library();
    const signature = factsSignature(playerFacts(before)!);
    expect(factsSignature(playerFacts([...before, game({ status: 'finished' })])!)).not.toBe(
      signature,
    );
    expect(
      factsSignature(playerFacts([...before.slice(1), { ...before[0], rating: 3 }])!),
    ).not.toBe(signature);
  });
});
