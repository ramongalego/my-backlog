import type { GameItem } from '@/lib/data/loaders';
import {
  countLibrary,
  filterLibrary,
  searchLibrary,
  type GameFilter,
  type GameSort,
} from '@/lib/games/library-filter';

// What the Games page does with its filter, search and sort, in one call.
const filterAndSortGames = (
  games: GameItem[],
  filter: GameFilter,
  searchQuery: string,
  sort: GameSort = 'playtime',
) => filterLibrary(searchLibrary(games, searchQuery), filter, sort, searchQuery);
const filterGames = (games: GameItem[], filter: GameFilter, searchQuery: string) =>
  filterAndSortGames(games, filter, searchQuery);
const computeCounts = (games: GameItem[], searchQuery = '') =>
  countLibrary(searchLibrary(games, searchQuery));

const createGame = (overrides: Partial<GameItem> = {}): GameItem => ({
  source: 'steam',
  platform: null,
  id: 1,
  app_id: 1,
  name: 'Test Game',
  playtime_forever: 100,
  steam_review_score: 90,
  steam_review_count: 1000,
  critic_score: null,
  critic_count: null,
  steam_review_weighted: 85,
  header_image: 'https://example.com/image.jpg',
  main_story_hours: 10,
  status: 'backlog',
  created_at: '2026-01-01T00:00:00Z',
  release_date: null,
  last_played_at: null,
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  tags: null,
  ...overrides,
});

describe('filtering the library', () => {
  const sampleGames: GameItem[] = [
    createGame({ id: 1, app_id: 1, name: 'The Legend of Zelda', status: 'backlog' }),
    createGame({ id: 2, app_id: 2, name: 'Final Fantasy VII', status: 'finished' }),
    createGame({ id: 3, app_id: 3, name: 'Mario Kart', status: 'backlog' }),
    createGame({ id: 4, app_id: 4, name: 'Dark Souls', status: 'dropped' }),
    createGame({ id: 5, app_id: 5, name: 'Hidden Gem', status: 'hidden' }),
    createGame({ id: 6, app_id: 6, name: 'Elden Ring', status: 'playing' }),
  ];

  describe('search filtering', () => {
    it('should filter games by name (case-insensitive)', () => {
      const result = filterGames(sampleGames, 'all', 'zelda');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('The Legend of Zelda');
    });

    it('should filter games by name with uppercase query', () => {
      const result = filterGames(sampleGames, 'all', 'ZELDA');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('The Legend of Zelda');
    });

    it('should match partial names', () => {
      const result = filterGames(sampleGames, 'all', 'mario');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Mario Kart');
    });

    it('should return all library games when search is empty', () => {
      const result = filterGames(sampleGames, 'all', '');

      // 6 games − 1 hidden = 5: the game being played is listed too.
      expect(result).toHaveLength(5);
    });

    it('should return empty array when no matches', () => {
      const result = filterGames(sampleGames, 'all', 'nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should match games containing the search term anywhere', () => {
      const result = filterGames(sampleGames, 'all', 'of');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('The Legend of Zelda');
    });

    it('should handle mixed case in game names', () => {
      const result = filterGames(sampleGames, 'all', 'FINAL');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Final Fantasy VII');
    });
  });

  describe('tag search', () => {
    const gamesWithTags: GameItem[] = [
      createGame({
        id: 1,
        app_id: 1,
        name: 'Dark Souls',
        status: 'backlog',
        tags: ['Action', 'Souls-like', 'Difficult'],
      }),
      createGame({
        id: 2,
        app_id: 2,
        name: 'Persona 5',
        status: 'backlog',
        tags: ['JRPG', 'Turn-Based', 'Anime'],
      }),
      createGame({
        id: 3,
        app_id: 3,
        name: 'Hades',
        status: 'backlog',
        tags: ['Roguelike', 'Action', 'Indie'],
      }),
      createGame({ id: 4, app_id: 4, name: 'No Tags Game', status: 'backlog', tags: null }),
    ];

    it('should filter by tag (case-insensitive)', () => {
      const result = filterGames(gamesWithTags, 'all', 'jrpg');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Persona 5');
    });

    it('should filter by partial tag match', () => {
      const result = filterGames(gamesWithTags, 'all', 'rogue');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Hades');
    });

    it('should return multiple games matching a tag', () => {
      const result = filterGames(gamesWithTags, 'all', 'action');

      expect(result).toHaveLength(2);
      expect(result.map((g) => g.name)).toContain('Dark Souls');
      expect(result.map((g) => g.name)).toContain('Hades');
    });

    it('should match by name even when tags are present', () => {
      const result = filterGames(gamesWithTags, 'all', 'persona');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Persona 5');
    });

    it('should handle games with null tags gracefully', () => {
      const result = filterGames(gamesWithTags, 'all', 'action');

      expect(result.map((g) => g.name)).not.toContain('No Tags Game');
    });

    it('should return empty when tag does not match any game', () => {
      const result = filterGames(gamesWithTags, 'all', 'sports');

      expect(result).toHaveLength(0);
    });
  });

  describe('combined filters (status + search)', () => {
    it('should combine status and search filters', () => {
      const result = filterGames(sampleGames, 'backlog', 'legend');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('The Legend of Zelda');
    });

    it('should return empty when filters have no overlap', () => {
      const result = filterGames(sampleGames, 'finished', 'zelda');

      expect(result).toHaveLength(0);
    });

    it('should exclude hidden games with "all" filter even with matching search', () => {
      const result = filterGames(sampleGames, 'all', 'hidden');

      expect(result).toHaveLength(0);
    });

    it('should show hidden games only with "hidden" filter', () => {
      const result = filterGames(sampleGames, 'hidden', '');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Hidden Gem');
    });

    it('should filter hidden games by search when using hidden filter', () => {
      const result = filterGames(sampleGames, 'hidden', 'gem');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Hidden Gem');
    });
  });

  describe('status filtering', () => {
    it('should filter by finished status', () => {
      const result = filterGames(sampleGames, 'finished', '');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Final Fantasy VII');
    });

    it('should filter by dropped status', () => {
      const result = filterGames(sampleGames, 'dropped', '');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Dark Souls');
    });

    it('lists the game being played under All and Backlog, like queued games', () => {
      expect(filterGames(sampleGames, 'all', '').map((g) => g.name)).toContain('Elden Ring');
      expect(filterGames(sampleGames, 'backlog', '').map((g) => g.name)).toEqual(
        expect.arrayContaining(['The Legend of Zelda', 'Mario Kart', 'Elden Ring']),
      );
      expect(filterGames(sampleGames, 'finished', '').map((g) => g.name)).not.toContain(
        'Elden Ring',
      );
    });

    it('should filter by wont_play status', () => {
      const gamesWithWontPlay = [
        ...sampleGames,
        createGame({ id: 99, app_id: 99, name: 'Boring Game', status: 'wont_play' }),
      ];
      const result = filterGames(gamesWithWontPlay, 'wont_play', '');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Boring Game');
    });

    it('should show every game but hidden ones (including wont_play) with "all" filter', () => {
      const gamesWithWontPlay = [
        ...sampleGames,
        createGame({ id: 99, app_id: 99, name: 'Boring Game', status: 'wont_play' }),
      ];
      const result = filterGames(gamesWithWontPlay, 'all', '');

      // 7 games − 1 hidden = 6 (Zelda, FF, Mario, Dark Souls, Elden Ring, Boring)
      expect(result).toHaveLength(6);
      expect(result.map((g) => g.name)).not.toContain('Hidden Gem');
      expect(result.map((g) => g.name)).toContain('Boring Game');
    });
  });

  describe('performance considerations', () => {
    it('should handle large lists efficiently', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) =>
        createGame({ id: i, app_id: i, name: `Game ${i}`, status: 'backlog' }),
      );

      const start = performance.now();
      const result = filterGames(largeList, 'all', 'game 500');
      const duration = performance.now() - start;

      expect(result).toHaveLength(1);
      expect(duration).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should handle empty search efficiently', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) =>
        createGame({ id: i, app_id: i, name: `Game ${i}`, status: 'backlog' }),
      );

      const start = performance.now();
      const result = filterGames(largeList, 'all', '');
      const duration = performance.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('sorting', () => {
    const gamesForSorting: GameItem[] = [
      createGame({
        id: 1,
        app_id: 1,
        name: 'Game A',
        playtime_forever: 100,
        steam_review_score: 70,
        status: 'backlog',
      }),
      createGame({
        id: 3,
        app_id: 3,
        name: 'Game B',
        playtime_forever: 300,
        steam_review_score: 90,
        status: 'backlog',
      }),
      createGame({
        id: 2,
        app_id: 2,
        name: 'Game C',
        playtime_forever: 200,
        steam_review_score: 80,
        status: 'backlog',
      }),
    ];

    it('should sort by playtime (descending) by default', () => {
      const result = filterAndSortGames(gamesForSorting, 'all', '', 'playtime');

      expect(result[0].name).toBe('Game B'); // 300 playtime
      expect(result[1].name).toBe('Game C'); // 200 playtime
      expect(result[2].name).toBe('Game A'); // 100 playtime
    });

    it('should sort by score (descending)', () => {
      const result = filterAndSortGames(gamesForSorting, 'all', '', 'score');

      expect(result[0].name).toBe('Game B'); // 90 score
      expect(result[1].name).toBe('Game C'); // 80 score
      expect(result[2].name).toBe('Game A'); // 70 score
    });

    it('should fall back to app_id (newest on Steam) when games joined the library together', () => {
      const result = filterAndSortGames(gamesForSorting, 'all', '', 'recent');

      expect(result[0].name).toBe('Game B'); // app_id 3
      expect(result[1].name).toBe('Game C'); // app_id 2
      expect(result[2].name).toBe('Game A'); // app_id 1
    });

    it('should sort recently added by when the game joined the library', () => {
      const games = [
        createGame({
          id: 900,
          app_id: 900,
          name: 'First sync, new on Steam',
          created_at: '2026-01-26T20:33:00Z',
        }),
        createGame({ id: 10, app_id: 10, name: 'Bought last', created_at: '2026-10-25T13:53:00Z' }),
        createGame({
          id: 20,
          app_id: 20,
          name: 'Bought in April',
          created_at: '2026-04-04T17:10:00Z',
        }),
      ];

      const result = filterAndSortGames(games, 'all', '', 'recent');

      expect(result.map((g) => g.name)).toEqual([
        'Bought last',
        'Bought in April',
        'First sync, new on Steam',
      ]);
    });

    it('should sort by my rating, then most recently finished, with unrated games last', () => {
      const finished = (o: Partial<GameItem>) => createGame({ status: 'finished', ...o });
      const games = [
        createGame({
          id: 1,
          app_id: 1,
          name: 'Unrated, great on Steam',
          rating: null,
          steam_review_score: 99,
        }),
        finished({
          id: 2,
          app_id: 2,
          name: '8, finished 2024',
          rating: 8,
          finished_at: '2024-05-01',
        }),
        finished({ id: 3, app_id: 3, name: '10', rating: 10, finished_at: '2021-01-01' }),
        finished({
          id: 4,
          app_id: 4,
          name: '8, finished 2025',
          rating: 8,
          finished_at: '2025-08-20',
        }),
        createGame({ id: 6, app_id: 6, name: 'Dropped at 4', status: 'dropped', rating: 4 }),
        finished({ id: 5, app_id: 5, name: 'Rated 0', rating: 0, finished_at: '2023-01-01' }),
      ];

      const result = filterAndSortGames(games, 'all', '', 'rating');

      expect(result.map((g) => g.name)).toEqual([
        '10',
        '8, finished 2025',
        '8, finished 2024',
        'Dropped at 4',
        'Rated 0',
        'Unrated, great on Steam',
      ]);
    });

    it('should ignore a rating left on a game that is back in the backlog', () => {
      const games = [
        createGame({
          id: 1,
          app_id: 1,
          name: 'Backlog, old 10',
          status: 'backlog',
          rating: 10,
          steam_review_score: 50,
        }),
        createGame({ id: 2, app_id: 2, name: 'Finished 6', status: 'finished', rating: 6 }),
        createGame({
          id: 3,
          app_id: 3,
          name: 'Backlog, unrated',
          status: 'backlog',
          rating: null,
          steam_review_score: 90,
        }),
      ];

      const result = filterAndSortGames(games, 'all', '', 'rating');

      expect(result.map((g) => g.name)).toEqual([
        'Finished 6',
        'Backlog, unrated',
        'Backlog, old 10',
      ]);
    });

    it('should sort by release date, newest first, with unknown dates last', () => {
      const games = [
        createGame({ id: 1, app_id: 1, name: 'TBA', release_date: 'To be announced' }),
        createGame({ id: 2, app_id: 2, name: '2010', release_date: 'Sep 28, 2010' }),
        createGame({ id: 3, app_id: 3, name: 'No date', release_date: null }),
        createGame({ id: 4, app_id: 4, name: '2023', release_date: 'Jun 16, 2023' }),
      ];

      const result = filterAndSortGames(games, 'all', '', 'released');

      expect(result.slice(0, 2).map((g) => g.name)).toEqual(['2023', '2010']);
      expect(
        result
          .slice(2)
          .map((g) => g.name)
          .sort(),
      ).toEqual(['No date', 'TBA']);
    });

    it('should handle null scores when sorting by score', () => {
      const gamesWithNullScore = [
        createGame({
          id: 1,
          app_id: 1,
          name: 'No Score',
          steam_review_score: null,
          status: 'backlog',
        }),
        createGame({
          id: 2,
          app_id: 2,
          name: 'Has Score',
          steam_review_score: 85,
          status: 'backlog',
        }),
      ];

      const result = filterAndSortGames(gamesWithNullScore, 'all', '', 'score');

      expect(result[0].name).toBe('Has Score');
      expect(result[1].name).toBe('No Score');
    });

    it('should apply sorting after filtering', () => {
      const mixedGames = [
        createGame({
          id: 1,
          app_id: 1,
          name: 'Backlog Game A',
          playtime_forever: 100,
          status: 'backlog',
        }),
        createGame({
          id: 2,
          app_id: 2,
          name: 'Finished Game',
          playtime_forever: 500,
          status: 'finished',
        }),
        createGame({
          id: 3,
          app_id: 3,
          name: 'Backlog Game B',
          playtime_forever: 200,
          status: 'backlog',
        }),
      ];

      const result = filterAndSortGames(mixedGames, 'backlog', '', 'playtime');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Backlog Game B'); // Higher playtime among backlog
      expect(result[1].name).toBe('Backlog Game A');
    });
  });
});

describe('counting the library', () => {
  const sampleGames: GameItem[] = [
    createGame({ id: 1, app_id: 1, name: 'Zelda', status: 'backlog' }),
    createGame({ id: 2, app_id: 2, name: 'Final Fantasy', status: 'finished' }),
    createGame({ id: 3, app_id: 3, name: 'Mario', status: 'backlog', tags: ['Platformer'] }),
    createGame({ id: 4, app_id: 4, name: 'Dark Souls', status: 'dropped' }),
    createGame({ id: 5, app_id: 5, name: 'Hidden Gem', status: 'hidden' }),
    createGame({ id: 6, app_id: 6, name: 'New Game', status: 'backlog' }),
    createGame({ id: 7, app_id: 7, name: 'Now Playing', status: 'playing' }),
    createGame({ id: 8, app_id: 8, name: 'Wont Bother', status: 'wont_play' }),
  ];

  it('counts every game but hidden ones under All', () => {
    const counts = computeCounts(sampleGames);
    // 8 games − 1 hidden = 7. Won't-play games and the one being played are included.
    expect(counts.all).toBe(7);
    expect(counts.hidden).toBe(1);
    expect(counts.wont_play).toBe(1);
  });

  it('counts the game being played under Backlog, where it is listed', () => {
    const counts = computeCounts(sampleGames);
    expect(counts.backlog).toBe(4); // Zelda + Mario + New Game + Now Playing
  });

  it('has each count match what its filter lists', () => {
    const counts = computeCounts(sampleGames);
    for (const filter of [
      'all',
      'backlog',
      'finished',
      'dropped',
      'wont_play',
      'hidden',
    ] as const) {
      expect(counts[filter]).toBe(filterGames(sampleGames, filter, '').length);
    }
    expect(counts.all).toBe(counts.backlog + counts.finished + counts.dropped + counts.wont_play);
  });

  it('follows the search', () => {
    expect(computeCounts(sampleGames, 'mario')).toEqual({
      all: 1,
      backlog: 1,
      finished: 0,
      dropped: 0,
      wont_play: 0,
      hidden: 0,
    });
  });

  it('counts the whole library when the search is cleared', () => {
    expect(computeCounts(sampleGames, '')).toEqual({
      all: 7,
      backlog: 4,
      finished: 1,
      dropped: 1,
      wont_play: 1,
      hidden: 1,
    });
  });

  it('counts a game the search finds by its tag', () => {
    const counts = computeCounts(sampleGames, 'platformer'); // Mario, by tag
    expect(counts.all).toBe(1);
    expect(counts.backlog).toBe(1);
  });

  it('is all zeros when the search finds nothing', () => {
    expect(computeCounts(sampleGames, 'xyznotfound')).toEqual({
      all: 0,
      backlog: 0,
      finished: 0,
      dropped: 0,
      wont_play: 0,
      hidden: 0,
    });
  });

  it("doesn't reorder the list it was given", () => {
    const before = sampleGames.map((g) => g.id);
    filterAndSortGames(sampleGames, 'all', '', 'playtime');
    filterAndSortGames(sampleGames, 'all', 'a', 'recent');
    expect(sampleGames.map((g) => g.id)).toEqual(before);
  });

  it('lists games named for the search before those only tagged with it', () => {
    const games = [
      createGame({ id: 1, name: 'Hollow Knight', tags: ['Metroidvania'], playtime_forever: 900 }),
      createGame({ id: 2, name: 'Metroid Dread', tags: ['Action'], playtime_forever: 10 }),
    ];
    expect(filterAndSortGames(games, 'all', 'metroid', 'playtime').map((g) => g.name)).toEqual([
      'Metroid Dread',
      'Hollow Knight',
    ]);
  });
});
