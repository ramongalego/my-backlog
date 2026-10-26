import { compareGames, type GameItem, type GameFilter, type GameSort } from '@/hooks/useGamesPage';

// Test the filtering and sorting logic used in useGamesPage
// We extract the logic to test it independently of React hooks

function filterAndSortGames(
  games: GameItem[],
  filter: GameFilter,
  searchQuery: string,
  sort: GameSort = 'playtime',
): GameItem[] {
  const searchLower = searchQuery.toLowerCase();

  const filtered = games.filter((game) => {
    // Playing games live on the home page, never shown on the Games page.
    if (game.status === 'playing') return false;
    // Status filter — only hidden is excluded from "all"; wont_play still
    // appears there since it's part of the library.
    if (filter === 'all' && game.status === 'hidden') return false;
    if (filter === 'backlog' && game.status && game.status !== 'backlog') return false;
    if (filter !== 'all' && filter !== 'backlog' && game.status !== filter) return false;

    // Search filter — matches name or any tag
    if (searchLower) {
      const nameMatch = game.name.toLowerCase().includes(searchLower);
      const tagMatch = game.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false;
      if (!nameMatch && !tagMatch) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => compareGames(a, b, sort));
}

function filterGames(games: GameItem[], filter: GameFilter, searchQuery: string): GameItem[] {
  return filterAndSortGames(games, filter, searchQuery, 'playtime');
}

const createGame = (overrides: Partial<GameItem> = {}): GameItem => ({
  id: 1,
  app_id: 1,
  name: 'Test Game',
  playtime_forever: 100,
  steam_review_score: 90,
  steam_review_count: 1000,
  steam_review_weighted: 85,
  header_image: 'https://example.com/image.jpg',
  main_story_hours: 10,
  status: 'backlog',
  created_at: '2026-01-01T00:00:00Z',
  release_date: null,
  last_played_at: null,
  categories: null,
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  tags: null,
  ...overrides,
});

describe('useGamesPage filtering logic', () => {
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

      // 6 games − 1 hidden − 1 playing = 4
      expect(result).toHaveLength(4);
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
    it('should filter by backlog status including null status', () => {
      const gamesWithNull = [
        ...sampleGames,
        createGame({ id: 6, app_id: 6, name: 'New Game', status: null }),
      ];
      const result = filterGames(gamesWithNull, 'backlog', '');

      expect(result.map((g) => g.name)).toContain('New Game');
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

    it('should exclude playing games from the Games page entirely', () => {
      // Playing games live on the home page's Currently Playing tile. The
      // Games page lists the rest of the library, so filter counts sum cleanly.
      const result = filterGames(sampleGames, 'all', '');
      expect(result.map((g) => g.name)).not.toContain('Elden Ring');
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

    it('should show non-hidden / non-playing games (including wont_play) with "all" filter', () => {
      const gamesWithWontPlay = [
        ...sampleGames,
        createGame({ id: 99, app_id: 99, name: 'Boring Game', status: 'wont_play' }),
      ];
      const result = filterGames(gamesWithWontPlay, 'all', '');

      // 7 games − 1 hidden − 1 playing = 5 (Zelda, FF, Mario, Dark Souls, Boring)
      expect(result).toHaveLength(5);
      expect(result.map((g) => g.name)).not.toContain('Hidden Gem');
      expect(result.map((g) => g.name)).not.toContain('Elden Ring');
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
        steam_review_weighted: 70,
        status: 'backlog',
      }),
      createGame({
        id: 3,
        app_id: 3,
        name: 'Game B',
        playtime_forever: 300,
        steam_review_weighted: 90,
        status: 'backlog',
      }),
      createGame({
        id: 2,
        app_id: 2,
        name: 'Game C',
        playtime_forever: 200,
        steam_review_weighted: 80,
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
          steam_review_weighted: 99,
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
          steam_review_weighted: 50,
        }),
        createGame({ id: 2, app_id: 2, name: 'Finished 6', status: 'finished', rating: 6 }),
        createGame({
          id: 3,
          app_id: 3,
          name: 'Backlog, unrated',
          status: 'backlog',
          rating: null,
          steam_review_weighted: 90,
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
          steam_review_weighted: null,
          status: 'backlog',
        }),
        createGame({
          id: 2,
          app_id: 2,
          name: 'Has Score',
          steam_review_weighted: 85,
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

// Count computation extracted for independent testing
function computeCounts(games: GameItem[]) {
  const result = { all: 0, backlog: 0, finished: 0, dropped: 0, wont_play: 0, hidden: 0 };
  for (const game of games) {
    const s = game.status;
    if (s === 'playing') continue; // Playing games aren't shown on the Games page.
    if (s === 'hidden') {
      result.hidden++;
    } else if (s === 'wont_play') {
      result.all++;
      result.wont_play++;
    } else if (s === 'finished') {
      result.all++;
      result.finished++;
    } else if (s === 'dropped') {
      result.all++;
      result.dropped++;
    } else {
      result.all++;
      result.backlog++;
    }
  }
  return result;
}

function searchFilter(games: GameItem[], query: string): GameItem[] {
  if (!query) return games;
  const q = query.toLowerCase();
  return games.filter((game) => {
    const nameMatch = game.name.toLowerCase().includes(q);
    const tagMatch = game.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false;
    return nameMatch || tagMatch;
  });
}

describe('useGamesPage count computation', () => {
  const sampleGames: GameItem[] = [
    createGame({ id: 1, app_id: 1, name: 'Zelda', status: 'backlog' }),
    createGame({ id: 2, app_id: 2, name: 'Final Fantasy', status: 'finished' }),
    createGame({ id: 3, app_id: 3, name: 'Mario', status: 'backlog', tags: ['Platformer'] }),
    createGame({ id: 4, app_id: 4, name: 'Dark Souls', status: 'dropped' }),
    createGame({ id: 5, app_id: 5, name: 'Hidden Gem', status: 'hidden' }),
    createGame({ id: 6, app_id: 6, name: 'New Game', status: null }),
    createGame({ id: 7, app_id: 7, name: 'Now Playing', status: 'playing' }),
    createGame({ id: 8, app_id: 8, name: 'Wont Bother', status: 'wont_play' }),
  ];

  it('should exclude hidden and playing games from all count (wont_play is included)', () => {
    const counts = computeCounts(sampleGames);
    // 8 games − 1 hidden − 1 playing = 6. wont_play IS included.
    expect(counts.all).toBe(6);
    expect(counts.hidden).toBe(1);
    expect(counts.wont_play).toBe(1);
  });

  it('should count null status as backlog', () => {
    const counts = computeCounts(sampleGames);
    expect(counts.backlog).toBe(3); // Zelda + Mario + New Game (null)
  });

  it('should have all = backlog + finished + dropped + wont_play', () => {
    const counts = computeCounts(sampleGames);
    // The visible buckets must sum cleanly to `all` — this is the invariant
    // that was broken when playing games used to contribute to `all`.
    expect(counts.all).toBe(counts.backlog + counts.finished + counts.dropped + counts.wont_play);
  });

  it('should return dynamic counts when search query is active', () => {
    const filtered = searchFilter(sampleGames, 'mario');
    const counts = computeCounts(filtered);
    expect(counts.all).toBe(1);
    expect(counts.backlog).toBe(1);
    expect(counts.finished).toBe(0);
    expect(counts.dropped).toBe(0);
    expect(counts.wont_play).toBe(0);
    expect(counts.hidden).toBe(0);
  });

  it('should return static counts when search is cleared', () => {
    const filtered = searchFilter(sampleGames, '');
    const counts = computeCounts(filtered);
    expect(counts.all).toBe(6);
    expect(counts.backlog).toBe(3);
    expect(counts.finished).toBe(1);
    expect(counts.dropped).toBe(1);
    expect(counts.wont_play).toBe(1);
    expect(counts.hidden).toBe(1);
  });

  it('should reflect cross-status search results in counts', () => {
    const filtered = searchFilter(sampleGames, 'platformer'); // matches Mario by tag
    const counts = computeCounts(filtered);
    expect(counts.all).toBe(1);
    expect(counts.backlog).toBe(1);
  });

  it('should return all zeros when search matches nothing', () => {
    const filtered = searchFilter(sampleGames, 'xyznotfound');
    const counts = computeCounts(filtered);
    expect(counts.all).toBe(0);
    expect(counts.backlog).toBe(0);
    expect(counts.finished).toBe(0);
    expect(counts.dropped).toBe(0);
    expect(counts.wont_play).toBe(0);
    expect(counts.hidden).toBe(0);
  });
});

// Pagination logic extracted for independent testing
const BATCH_SIZE = 60;

function paginateGames(games: GameItem[], visibleCount: number) {
  return {
    visibleGames: games.slice(0, visibleCount),
    hasMore: visibleCount < games.length,
  };
}

describe('useGamesPage pagination logic', () => {
  const makeGames = (count: number): GameItem[] =>
    Array.from({ length: count }, (_, i) =>
      createGame({ id: i + 1, app_id: i + 1, name: `Game ${i + 1}` }),
    );

  it('should show only the first batch when visibleCount equals BATCH_SIZE', () => {
    const games = makeGames(200);
    const { visibleGames } = paginateGames(games, BATCH_SIZE);

    expect(visibleGames).toHaveLength(BATCH_SIZE);
    expect(visibleGames[0].name).toBe('Game 1');
    expect(visibleGames[BATCH_SIZE - 1].name).toBe(`Game ${BATCH_SIZE}`);
  });

  it('should report hasMore true when games exceed visibleCount', () => {
    const games = makeGames(200);
    const { hasMore } = paginateGames(games, BATCH_SIZE);

    expect(hasMore).toBe(true);
  });

  it('should report hasMore false when all games are visible', () => {
    const games = makeGames(30);
    const { hasMore } = paginateGames(games, BATCH_SIZE);

    expect(hasMore).toBe(false);
  });

  it('should show all games after enough loadMore calls', () => {
    const games = makeGames(130);
    const { visibleGames } = paginateGames(games, BATCH_SIZE * 3);

    expect(visibleGames).toHaveLength(130);
  });

  it('should show next batch after one loadMore', () => {
    const games = makeGames(200);
    const { visibleGames } = paginateGames(games, BATCH_SIZE * 2);

    expect(visibleGames).toHaveLength(BATCH_SIZE * 2);
  });

  it('should handle fewer games than batch size', () => {
    const games = makeGames(10);
    const { visibleGames, hasMore } = paginateGames(games, BATCH_SIZE);

    expect(visibleGames).toHaveLength(10);
    expect(hasMore).toBe(false);
  });

  it('should handle exactly batch size games', () => {
    const games = makeGames(BATCH_SIZE);
    const { visibleGames, hasMore } = paginateGames(games, BATCH_SIZE);

    expect(visibleGames).toHaveLength(BATCH_SIZE);
    expect(hasMore).toBe(false);
  });
});
