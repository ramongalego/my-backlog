import {
  buildCarouselPools,
  slimPools,
  type CarouselGame,
  type LovedGame,
} from '@/lib/games/carousels';
import { editionKey } from '@/lib/games/similarity';

let nextId = 1;
const game = (overrides: Partial<CarouselGame> = {}): CarouselGame => ({
  id: nextId,
  app_id: nextId++,
  name: `Game ${nextId}`,
  header_image: null,
  main_story_hours: 10,
  playtime_forever: 0,
  steam_review_score: 90,
  steam_review_count: 20000,
  steam_review_weighted: 85,
  deck_compat: null,
  tags: ['Action', 'Adventure'],
  categories: ['Single-player'],
  created_at: '2026-01-01T00:00:00Z',
  last_played_at: null,
  ...overrides,
});

const loved = (
  name: string,
  tags: string[],
  rating = 9,
  finished_at = '2026-06-01',
): LovedGame => ({
  name,
  rating,
  tags,
  finished_at,
});

const names = (games: CarouselGame[]) => games.map((g) => g.name);
const build = (backlog: CarouselGame[], lovedGames: LovedGame[] = []) =>
  buildCarouselPools(backlog, lovedGames, '2026-01-01T00:00:00Z');

describe('every carousel', () => {
  it('keeps one edition of a game, the better reviewed', () => {
    const pools = build([
      game({ name: 'Ori and the Blind Forest', steam_review_score: 80 }),
      game({ name: 'Ori and the Blind Forest: Definitive Edition', steam_review_score: 90 }),
      game({ name: 'Portal' }),
      game({ name: 'Portal 2' }),
    ]);
    expect(names(pools.weekendGamesPool)).toEqual([
      'Ori and the Blind Forest: Definitive Edition',
      'Portal',
      'Portal 2',
    ]);
  });

  it('leaves out multiplayer-first games that also list single-player', () => {
    const pools = build([
      game({ name: 'Alien Swarm', tags: ['Twin Stick Shooter', 'PvE', 'Co-op', 'Shooter'] }),
      game({ name: 'Pummel Party', tags: ['Party Game', 'Multiplayer', 'Local Multiplayer'] }),
      game({ name: 'Solo game' }),
    ]);
    expect(names(pools.weekendGamesPool)).toEqual(['Solo game']);
  });

  it('leaves out games you have played most of', () => {
    const pools = build([
      game({ name: 'Beaten', main_story_hours: 2.5, playtime_forever: 4 * 60 }),
      game({ name: 'Fresh', main_story_hours: 2.5 }),
    ]);
    expect(names(pools.shortGamesPool)).toEqual(['Fresh']);
  });
});

describe('length carousels', () => {
  it('sort into under 5 hours and a weekend', () => {
    const pools = build([
      game({ name: 'Two hours', main_story_hours: 2 }),
      game({ name: 'Five hours', main_story_hours: 5 }),
      game({ name: 'Nine hours', main_story_hours: 9 }),
      game({ name: 'Forty hours', main_story_hours: 40 }),
    ]);
    expect(names(pools.shortGamesPool).sort()).toEqual(['Five hours', 'Two hours']);
    expect(names(pools.weekendGamesPool)).toEqual(['Nine hours']);
  });

  it('skip fighting games, whose time is only the story mode', () => {
    const pools = build([
      game({ name: 'TEKKEN 7', main_story_hours: 3.6, tags: ['Fighting', '3D Fighter'] }),
      game({ name: 'Short adventure', main_story_hours: 3 }),
    ]);
    expect(names(pools.shortGamesPool)).toEqual(['Short adventure']);
  });
});

describe('Hidden Gems', () => {
  const gem = (name: string, steam_review_score: number, steam_review_count: number) =>
    game({ name, steam_review_score, steam_review_count });

  it('takes games rated 90%+ by 50 to 5,000 reviewers', () => {
    const pools = build([
      gem('Big hit', 97, 200000),
      gem('Gem', 93, 2600),
      gem('Tiny sample', 100, 12),
      gem('Good, not great', 88, 900),
      gem('Just in', 90, 5000),
    ]);
    expect(names(pools.hiddenGemsPool)).toEqual(['Gem', 'Just in']);
  });

  it('ranks by score, then the less-known game first', () => {
    const pools = build([
      gem('Well known', 94, 4800),
      gem('Top score', 97, 3000),
      gem('Barely known', 94, 120),
    ]);
    expect(names(pools.hiddenGemsPool)).toEqual(['Top score', 'Barely known', 'Well known']);
  });
});

describe('Pick Up Where You Left Off', () => {
  it('lists games you are into, furthest along first', () => {
    const pools = build([
      game({ name: 'Halfway', main_story_hours: 60, playtime_forever: 29 * 60 }),
      game({ name: 'A quarter in', main_story_hours: 40, playtime_forever: 10 * 60 }),
      game({ name: 'Barely tried', main_story_hours: 57, playtime_forever: 60 }),
      game({ name: 'Untouched', main_story_hours: 10 }),
      game({ name: 'Done', main_story_hours: 5, playtime_forever: 6 * 60 }),
      game({ name: 'No length, played a while', main_story_hours: null, playtime_forever: 180 }),
    ]);
    expect(names(pools.pickUpPool)).toEqual([
      'Halfway',
      'A quarter in',
      'No length, played a while',
    ]);
  });
});

describe('Pick Up order', () => {
  it('puts the most recently played first, then the furthest along', () => {
    const pools = build([
      game({
        main_story_hours: 40,
        name: 'Far along, old',
        playtime_forever: 9 * 60,
        last_played_at: '2025-01-01T00:00:00Z',
      }),
      game({
        main_story_hours: 40,
        name: 'Played yesterday',
        playtime_forever: 6 * 60,
        last_played_at: '2026-10-24T00:00:00Z',
      }),
      game({ name: 'No date', playtime_forever: 8 * 60, main_story_hours: 40 }),
    ]);
    expect(names(pools.pickUpPool)).toEqual(['Played yesterday', 'Far along, old', 'No date']);
  });
});

describe('More Like ...', () => {
  const jrpg = ['JRPG', 'Turn-Based Combat', 'Anime', 'Story Rich', 'RPG'];
  const shooter = ['FPS', 'Shooter', 'Multiplayer', 'Military'];

  it('seeds from your best-loved game and lists the backlog games most like it', () => {
    const pools = build(
      [
        game({ name: 'Trails of Cold Steel IV', tags: jrpg }),
        game({ name: 'Tales of Arise', tags: ['JRPG', 'Anime', 'Action RPG', 'Story Rich'] }),
        game({ name: 'Dragon Quest XI', tags: ['JRPG', 'Turn-Based Combat', 'RPG'] }),
        game({ name: 'DOOM', tags: shooter }),
      ],
      [
        loved('Castlevania Collection', ['Metroidvania', 'Platformer'], 8, '2026-09-01'),
        loved('Trails of Cold Steel III', jrpg, 9, '2026-01-01'),
      ],
    );
    expect(pools.moreLike?.basedOn).toBe('Trails of Cold Steel III');
    expect(pools.moreLike && names(pools.moreLike.games)).toEqual([
      'Trails of Cold Steel IV',
      'Dragon Quest XI',
      'Tales of Arise',
    ]);
  });

  it('skips poorly reviewed matches', () => {
    const pools = build(
      [
        game({ name: 'Great JRPG 1', tags: jrpg }),
        game({ name: 'Great JRPG 2', tags: jrpg }),
        game({ name: 'Poor JRPG', tags: jrpg, steam_review_score: 55 }),
      ],
      [loved('Trails of Cold Steel III', jrpg)],
    );
    expect(pools.moreLike).toBeNull();
  });

  it('is left out until you have rated a game 8 or higher', () => {
    const backlog = [1, 2, 3].map((i) => game({ name: `JRPG ${i}`, tags: jrpg }));
    expect(build(backlog).moreLike).toBeNull();
    expect(build(backlog, [loved('Okay JRPG', jrpg, 7)]).moreLike).toBeNull();
  });
});

describe('Recently Added', () => {
  it('lists games that arrived after the first import, newest first, unfiltered', () => {
    const pools = buildCarouselPools(
      [
        game({ name: 'First import', created_at: '2026-01-01T00:10:00Z' }),
        game({ name: 'Bought later', created_at: '2026-03-01T00:00:00Z' }),
        game({
          name: 'Multiplayer, bought last',
          created_at: '2026-04-01T00:00:00Z',
          categories: ['Multi-player'],
        }),
      ],
      [],
      '2026-01-01T00:00:00Z',
    );
    expect(names(pools.recentlyAddedPool)).toEqual(['Multiplayer, bought last', 'Bought later']);
  });
});

describe('editionKey', () => {
  it.each([
    ['Little Nightmares Enhanced Edition', 'little nightmares'],
    ['Ori and the Blind Forest: Definitive Edition', 'ori and blind forest'],
    ['Halcyon 6: Starbase Commander (CLASSIC)', 'halcyon 6 starbase commander'],
    ['Portal 2', 'portal 2'],
  ])('%s → %s', (name, key) => {
    expect(editionKey(name)).toBe(key);
  });
});

describe('slimPools', () => {
  it('drops the fields only the ranking needs before the rows are sent', () => {
    const pools = slimPools(build([game({ name: 'Tagged', tags: ['RPG', 'Story Rich'] })]));
    expect(pools.weekendGamesPool[0]).toMatchObject({
      name: 'Tagged',
      tags: null,
      categories: null,
    });
  });
});

describe('ratings', () => {
  it('ranks by both critics and players, so console games are rated too', () => {
    const steamOnly = game({ name: 'Steam only', steam_review_score: 85 });
    const console = game({
      name: 'Console',
      source: 'manual',
      platform: 'Switch',
      steam_review_score: null,
      steam_review_count: null,
      steam_review_weighted: null,
      critic_score: 93,
      critic_count: 9,
    });
    // Steam's players love it, critics didn't: the two average out lower.
    const critics = game({
      name: 'Critics',
      steam_review_score: 95,
      critic_score: 70,
      critic_count: 12,
    });
    expect(names(build([steamOnly, console, critics]).highlyRatedGamesPool)).toEqual([
      'Console',
      'Steam only',
      'Critics',
    ]);
  });
});
