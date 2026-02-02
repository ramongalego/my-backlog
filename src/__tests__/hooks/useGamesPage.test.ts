import type { GameItem, GameFilter, GameSort } from '@/hooks/useGamesPage';

// Test the filtering and sorting logic used in useGamesPage
// We extract the logic to test it independently of React hooks

function filterAndSortGames(
  games: GameItem[],
  filter: GameFilter,
  searchQuery: string,
  sort: GameSort = 'playtime'
): GameItem[] {
  const searchLower = searchQuery.toLowerCase();

  const filtered = games.filter(game => {
    // Status filter
    if (filter === 'all' && game.status === 'hidden') return false;
    if (filter === 'backlog' && game.status && game.status !== 'backlog') return false;
    if (filter !== 'all' && filter !== 'backlog' && game.status !== filter) return false;

    // Search filter
    if (searchLower && !game.name.toLowerCase().includes(searchLower)) {
      return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    switch (sort) {
      case 'score':
        return (b.steam_review_weighted ?? 0) - (a.steam_review_weighted ?? 0);
      case 'recent':
        return b.app_id - a.app_id;
      case 'playtime':
      default:
        return b.playtime_forever - a.playtime_forever;
    }
  });
}

function filterGames(
  games: GameItem[],
  filter: GameFilter,
  searchQuery: string
): GameItem[] {
  return filterAndSortGames(games, filter, searchQuery, 'playtime');
}

describe('useGamesPage filtering logic', () => {
  const createGame = (overrides: Partial<GameItem> = {}): GameItem => ({
    app_id: 1,
    name: 'Test Game',
    playtime_forever: 100,
    steam_review_score: 90,
    steam_review_count: 1000,
    steam_review_weighted: 85,
    header_image: 'https://example.com/image.jpg',
    main_story_hours: 10,
    status: 'backlog',
    ...overrides,
  });

  const sampleGames: GameItem[] = [
    createGame({ app_id: 1, name: 'The Legend of Zelda', status: 'backlog' }),
    createGame({ app_id: 2, name: 'Final Fantasy VII', status: 'finished' }),
    createGame({ app_id: 3, name: 'Mario Kart', status: 'backlog' }),
    createGame({ app_id: 4, name: 'Dark Souls', status: 'dropped' }),
    createGame({ app_id: 5, name: 'Hidden Gem', status: 'hidden' }),
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

    it('should return all non-hidden games when search is empty', () => {
      const result = filterGames(sampleGames, 'all', '');

      expect(result).toHaveLength(4); // excludes hidden
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
    it('should filter by backlog status including null status', () => {
      const gamesWithNull = [
        ...sampleGames,
        createGame({ app_id: 6, name: 'New Game', status: null }),
      ];
      const result = filterGames(gamesWithNull, 'backlog', '');

      expect(result.map(g => g.name)).toContain('New Game');
    });

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

    it('should show all non-hidden games with "all" filter', () => {
      const result = filterGames(sampleGames, 'all', '');

      expect(result).toHaveLength(4);
      expect(result.map(g => g.name)).not.toContain('Hidden Gem');
    });
  });

  describe('performance considerations', () => {
    it('should handle large lists efficiently', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) =>
        createGame({ app_id: i, name: `Game ${i}`, status: 'backlog' })
      );

      const start = performance.now();
      const result = filterGames(largeList, 'all', 'game 500');
      const duration = performance.now() - start;

      expect(result).toHaveLength(1);
      expect(duration).toBeLessThan(50); // Should complete in under 50ms
    });

    it('should handle empty search efficiently', () => {
      const largeList = Array.from({ length: 1000 }, (_, i) =>
        createGame({ app_id: i, name: `Game ${i}`, status: 'backlog' })
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
      createGame({ app_id: 1, name: 'Game A', playtime_forever: 100, steam_review_weighted: 70, status: 'backlog' }),
      createGame({ app_id: 3, name: 'Game B', playtime_forever: 300, steam_review_weighted: 90, status: 'backlog' }),
      createGame({ app_id: 2, name: 'Game C', playtime_forever: 200, steam_review_weighted: 80, status: 'backlog' }),
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

    it('should sort by most recent (app_id descending)', () => {
      const result = filterAndSortGames(gamesForSorting, 'all', '', 'recent');

      expect(result[0].name).toBe('Game B'); // app_id 3
      expect(result[1].name).toBe('Game C'); // app_id 2
      expect(result[2].name).toBe('Game A'); // app_id 1
    });

    it('should handle null scores when sorting by score', () => {
      const gamesWithNullScore = [
        createGame({ app_id: 1, name: 'No Score', steam_review_weighted: null, status: 'backlog' }),
        createGame({ app_id: 2, name: 'Has Score', steam_review_weighted: 85, status: 'backlog' }),
      ];

      const result = filterAndSortGames(gamesWithNullScore, 'all', '', 'score');

      expect(result[0].name).toBe('Has Score');
      expect(result[1].name).toBe('No Score');
    });

    it('should apply sorting after filtering', () => {
      const mixedGames = [
        createGame({ app_id: 1, name: 'Backlog Game A', playtime_forever: 100, status: 'backlog' }),
        createGame({ app_id: 2, name: 'Finished Game', playtime_forever: 500, status: 'finished' }),
        createGame({ app_id: 3, name: 'Backlog Game B', playtime_forever: 200, status: 'backlog' }),
      ];

      const result = filterAndSortGames(mixedGames, 'backlog', '', 'playtime');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Backlog Game B'); // Higher playtime among backlog
      expect(result[1].name).toBe('Backlog Game A');
    });
  });
});
