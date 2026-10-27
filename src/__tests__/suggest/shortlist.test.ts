import {
  historyWeight,
  isMultiplayerOnly,
  isSoftware,
  pickShortlist,
  scoreCandidates,
  seriesKey,
  seriesMatch,
  timeFit,
  type CandidateGame,
  type HistoryGame,
} from '@/lib/suggest/shortlist';
import type { SuggestionPreferences } from '@/lib/suggest/types';

const NOW = new Date('2026-10-25T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

let nextId = 1;
const game = (overrides: Partial<CandidateGame> = {}): CandidateGame => ({
  id: nextId++,
  name: `Game ${nextId}`,
  genres: ['Action'],
  categories: ['Single-player'],
  tags: ['Action', 'Story Rich'],
  main_story_hours: 10,
  playtime_forever: 0,
  steam_review_weighted: 80,
  critic_score: null,
  critic_count: null,
  reroll_count: 0,
  last_rerolled_at: null,
  ...overrides,
});

const finished = (name: string, rating: number | null, tags: string[] = []): HistoryGame => ({
  name,
  status: 'finished',
  rating,
  tags,
});

const prefs = (overrides: Partial<SuggestionPreferences> = {}): SuggestionPreferences => ({
  mood: 'emotional',
  energy: 'medium',
  time: 'medium',
  ...overrides,
});

const names = (games: { game: CandidateGame }[]) => games.map((c) => c.game.name);

describe('timeFit', () => {
  it('matches the ranges the wizard shows', () => {
    expect(timeFit(game({ main_story_hours: 4 }), 'short')).toBe('fit');
    expect(timeFit(game({ main_story_hours: 8 }), 'short')).toBe(3);
    expect(timeFit(game({ main_story_hours: 12 }), 'medium')).toBe('fit');
    expect(timeFit(game({ main_story_hours: 3 }), 'medium')).toBe(2);
    expect(timeFit(game({ main_story_hours: 18 }), 'long')).toBe('fit');
    expect(timeFit(game({ main_story_hours: 10 }), 'long')).toBe(5);
  });

  it('counts run-based games as one session however long they are', () => {
    const roguelike = game({ main_story_hours: 25, tags: ['Action Roguelike', 'Bullet Hell'] });
    expect(timeFit(roguelike, 'short')).toBe('fit');
    expect(timeFit(roguelike, 'medium')).toBe(10);
  });

  it('reports unknown lengths', () => {
    expect(timeFit(game({ main_story_hours: null }), 'long')).toBe('unknown');
  });
});

describe('filters', () => {
  it('spots multiplayer-only games', () => {
    expect(isMultiplayerOnly(game({ categories: ['Multi-player', 'PvP'] }))).toBe(true);
    expect(isMultiplayerOnly(game({ categories: ['Single-player', 'Multi-player'] }))).toBe(false);
    expect(isMultiplayerOnly(game({ categories: null }))).toBe(false);
  });

  it('spots software', () => {
    expect(isSoftware(game({ genres: ['Animation & Modeling', 'Utilities'] }))).toBe(true);
    expect(isSoftware(game({ genres: ['Casual'], tags: ['Software', 'Utilities'] }))).toBe(true);
    expect(isSoftware(game({ genres: ['RPG'], tags: ['RPG'] }))).toBe(false);
  });

  it('never shortlists them', () => {
    const ranked = scoreCandidates(
      [
        game({ name: 'EVE', categories: ['Multi-player', 'MMO'] }),
        game({ name: 'Spriter Pro', genres: ['Animation & Modeling'] }),
        game({ name: 'Real Game' }),
      ],
      [],
      prefs(),
      NOW,
    );
    expect(names(ranked)).toEqual(['Real Game']);
  });
});

describe('penalties', () => {
  it('push multiplayer-focused games down even when they list single-player', () => {
    const ranked = scoreCandidates(
      [
        game({ name: 'Party', tags: ['Multiplayer', 'Battle Royale', 'Online Co-Op', 'Cute'] }),
        game({ name: 'Solo', tags: ['Cute', 'Exploration'] }),
      ],
      [],
      prefs({ mood: 'relaxed' }),
      NOW,
    );
    expect(names(ranked)).toEqual(['Solo', 'Party']);
  });

  it('only suggest idlers when energy is low', () => {
    const idler = game({ name: 'Idler', tags: ['Idler', 'Automation', 'Economy', 'Management'] });
    const strategy = game({ name: 'Strategy', tags: ['Strategy', 'Turn-Based Tactics'] });
    const [high] = scoreCandidates(
      [idler, strategy],
      [],
      prefs({ mood: 'engaged', energy: 'high' }),
      NOW,
    );
    expect(high.game.name).toBe('Strategy');
  });
});

describe('series', () => {
  it('strips numbers, editions and articles', () => {
    expect(seriesKey('The Legend of Heroes: Trails of Cold Steel IV')).toBe(
      'legend of heroes: trails of cold steel',
    );
    expect(seriesKey('Portal 2')).toBe('portal');
    expect(seriesKey('Castlevania: Lords of Shadow - Ultimate Edition')).toBe(
      'castlevania: lords of shadow',
    );
  });

  it('tells entries of a series from games in the same franchise', () => {
    expect(
      seriesMatch(
        'The Legend of Heroes: Trails of Cold Steel IV',
        'The Legend of Heroes: Trails of Cold Steel III',
      ),
    ).toBe(1);
    expect(seriesMatch('Castlevania: Lords of Shadow', 'Castlevania Advance Collection')).toBe(0.5);
    expect(seriesMatch('Hades', 'Celeste')).toBe(0);
  });

  it('puts the next entry of a series you loved at the top', () => {
    const jrpg = ['JRPG', 'Turn-Based Combat', 'Story Rich', 'Anime', 'RPG'];
    const ranked = scoreCandidates(
      [
        game({ name: 'Trails of Cold Steel IV', tags: jrpg, main_story_hours: 60 }),
        game({
          name: 'Big Open World',
          tags: ['Open World', 'Story Rich'],
          main_story_hours: 40,
          steam_review_weighted: 95,
        }),
      ],
      [finished('Trails of Cold Steel III', 9, jrpg), finished('Trails of Cold Steel II', 8, jrpg)],
      prefs({ time: 'long' }),
      NOW,
    );
    expect(ranked[0].game.name).toBe('Trails of Cold Steel IV');
    expect(ranked[0].series?.name).toBe('Trails of Cold Steel III');
  });

  it('ignores a shared first word when the games play differently', () => {
    const [knights] = scoreCandidates(
      [game({ name: 'Portal Knights', tags: ['Sandbox', 'Crafting', 'Co-op'] })],
      [finished('Portal', 10, ['Puzzle', 'First-Person', 'Sci-fi'])],
      prefs(),
      NOW,
    );
    expect(knights.series).toBeNull();
  });
});

describe('taste', () => {
  it('weighs history by rating, and dropped games against', () => {
    expect(historyWeight(finished('A', 9))).toBe(1);
    expect(historyWeight(finished('A', 6))).toBe(0);
    expect(historyWeight(finished('A', 3))).toBe(-1);
    expect(historyWeight(finished('A', null))).toBeGreaterThan(0);
    expect(historyWeight({ name: 'A', status: 'dropped', rating: null, tags: [] })).toBeLessThan(0);
  });

  it('prefers games like the ones you rated highly', () => {
    const liked = ['Metroidvania', 'Platformer', '2D', 'Pixel Graphics'];
    const disliked = ['Visual Novel', 'Dating Sim', 'Anime'];
    const ranked = scoreCandidates(
      [game({ name: 'Like Disliked', tags: disliked }), game({ name: 'Like Loved', tags: liked })],
      [finished('Loved', 10, liked), finished('Hated', 2, disliked)],
      prefs({ mood: 'engaged' }),
      NOW,
    );
    expect(names(ranked)).toEqual(['Like Loved', 'Like Disliked']);
    expect(ranked[0].similarTo.map((g) => g.name)).toEqual(['Loved']);
  });
});

describe('mood and energy', () => {
  it('ranks by how well the tags fit the mood', () => {
    const cozy = game({ name: 'Cozy', tags: ['Relaxing', 'Cozy', 'Farming Sim', 'Cute'] });
    const brutal = game({ name: 'Brutal', tags: ['Souls-like', 'Difficult', 'Dark Fantasy'] });

    expect(
      names(scoreCandidates([brutal, cozy], [], prefs({ mood: 'relaxed', energy: 'low' }), NOW)),
    ).toEqual(['Cozy', 'Brutal']);
    expect(
      names(
        scoreCandidates([cozy, brutal], [], prefs({ mood: 'adrenaline', energy: 'high' }), NOW),
      ),
    ).toEqual(['Brutal', 'Cozy']);
  });
});

describe('time range', () => {
  it('keeps only games that fit, unless too few do', () => {
    const fits = [1, 2, 3].map((i) => game({ name: `Fits ${i}`, main_story_hours: 10 }));
    const tooLong = game({ name: 'Too long', main_story_hours: 40 });
    expect(names(scoreCandidates([...fits, tooLong], [], prefs(), NOW))).not.toContain('Too long');

    const [only] = fits;
    const ranked = scoreCandidates(
      [only, tooLong, game({ name: 'Way too long', main_story_hours: 90 })],
      [],
      prefs(),
      NOW,
    );
    expect(names(ranked).sort()).toEqual(['Fits 1', 'Too long', 'Way too long']);
    expect(ranked.find((c) => c.game.name === 'Too long')?.outsideTimeRange).toBe(true);
  });
});

describe('rerolls', () => {
  const ranked = (lastRerolled: string | null) =>
    scoreCandidates(
      [
        game({ name: 'Skipped', reroll_count: 3, last_rerolled_at: lastRerolled }),
        game({ name: 'Other' }),
      ],
      [],
      prefs(),
      NOW,
    );

  it('push a recently skipped game down', () => {
    const list = ranked(new Date(NOW - DAY).toISOString());
    expect(names(list)).toEqual(['Other', 'Skipped']);
    expect(list[1].recentlySkipped).toBe(true);
  });

  it('fade after a few months', () => {
    const list = ranked(new Date(NOW - 120 * DAY).toISOString());
    const skipped = list.find((c) => c.game.name === 'Skipped')!;
    const other = list.find((c) => c.game.name === 'Other')!;
    expect(skipped.score).toBeCloseTo(other.score, 1);
    expect(skipped.recentlySkipped).toBe(false);
  });

  it('are ignored when they predate the timestamp', () => {
    const list = ranked(null);
    expect(list[0].score).toBe(list[1].score);
  });
});

describe('pickShortlist', () => {
  const ranked = Array.from({ length: 60 }, (_, i) => ({
    game: game({ name: `G${i}` }),
    score: 10 - i * 0.1,
    series: null,
    similarTo: [],
    similarToDropped: null,
    recentlySkipped: false,
    outsideTimeRange: false,
  }));

  it('always keeps the best six and fills to twenty without repeats', () => {
    const list = pickShortlist(ranked, Math.random);
    expect(list).toHaveLength(20);
    expect(new Set(names(list)).size).toBe(20);
    for (let i = 0; i < 6; i++) expect(names(list)).toContain(`G${i}`);
  });

  it('only draws from the top of the ranking', () => {
    const list = pickShortlist(ranked, () => 0.999);
    const indexes = names(list).map((n) => Number(n.slice(1)));
    expect(Math.max(...indexes)).toBeLessThan(46);
  });

  it('returns everything when the backlog is small', () => {
    expect(pickShortlist(ranked.slice(0, 4))).toHaveLength(4);
  });
});
