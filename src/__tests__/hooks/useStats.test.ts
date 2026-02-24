// Extract the stats computation logic for independent testing

const EXCLUDED_TAGS = new Set([
  'Singleplayer',
  'Multiplayer',
  'Single-player',
  'Multi-player',
  'Quick-Time Events',
  'Reboot',
]);

interface GameForStats {
  name: string;
  status: string | null;
  playtime_forever: number;
  main_story_hours: number | null;
  tags: string[] | null;
  rating: number | null;
  finished_at: string | null;
  header_image: string | null;
  release_date: string | null;
}

function computeTagStats(games: GameForStats[]) {
  const tagCounts = new Map<string, number>();
  const tagFinishedCounts = new Map<string, number>();

  for (const game of games) {
    if (!game.tags) continue;
    for (const tag of game.tags) {
      if (EXCLUDED_TAGS.has(tag)) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      if (game.status === 'finished') {
        tagFinishedCounts.set(tag, (tagFinishedCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const tagCompletion = [...tagCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([tag, total]) => {
      const fin = tagFinishedCounts.get(tag) ?? 0;
      return { tag, total, finished: fin, pct: Math.round((fin / total) * 100) };
    })
    .sort((a, b) => b.pct * Math.log(b.total) - a.pct * Math.log(a.total))
    .slice(0, 12);

  return { topTags, tagCompletion };
}

const makeGame = (overrides: Partial<GameForStats> = {}): GameForStats => ({
  name: 'Test Game',
  status: 'backlog',
  playtime_forever: 0,
  main_story_hours: null,
  tags: null,
  rating: null,
  finished_at: null,
  header_image: null,
  release_date: null,
  ...overrides,
});

describe('useStats tag exclusion', () => {
  it('excludes Singleplayer from top tags', () => {
    const games = [
      makeGame({ tags: ['Singleplayer', 'RPG', 'Action'] }),
      makeGame({ tags: ['Singleplayer', 'RPG'] }),
      makeGame({ tags: ['Singleplayer', 'Action'] }),
    ];
    const { topTags } = computeTagStats(games);
    expect(topTags.map((t) => t.tag)).not.toContain('Singleplayer');
  });

  it('excludes Multiplayer from top tags', () => {
    const games = [
      makeGame({ tags: ['Multiplayer', 'Action'] }),
      makeGame({ tags: ['Multiplayer', 'Action'] }),
    ];
    const { topTags } = computeTagStats(games);
    expect(topTags.map((t) => t.tag)).not.toContain('Multiplayer');
  });

  it('excludes Single-player from top tags', () => {
    const games = [
      makeGame({ tags: ['Single-player', 'RPG'] }),
      makeGame({ tags: ['Single-player', 'RPG'] }),
    ];
    const { topTags } = computeTagStats(games);
    expect(topTags.map((t) => t.tag)).not.toContain('Single-player');
  });

  it('excludes Multi-player from top tags', () => {
    const games = [
      makeGame({ tags: ['Multi-player', 'FPS'] }),
      makeGame({ tags: ['Multi-player'] }),
    ];
    const { topTags } = computeTagStats(games);
    expect(topTags.map((t) => t.tag)).not.toContain('Multi-player');
  });

  it('excludes Quick-Time Events from top tags', () => {
    const games = [
      makeGame({ tags: ['Quick-Time Events', 'Action'] }),
      makeGame({ tags: ['Quick-Time Events', 'Action'] }),
    ];
    const { topTags } = computeTagStats(games);
    expect(topTags.map((t) => t.tag)).not.toContain('Quick-Time Events');
  });

  it('excludes all excluded tags from tag completion', () => {
    const games = Array.from({ length: 5 }, () =>
      makeGame({
        tags: ['Singleplayer', 'Multiplayer', 'RPG'],
        status: 'finished',
        finished_at: '2024-01-01',
      }),
    );
    const { tagCompletion } = computeTagStats(games);
    const tags = tagCompletion.map((t) => t.tag);
    expect(tags).not.toContain('Singleplayer');
    expect(tags).not.toContain('Multiplayer');
    expect(tags).toContain('RPG');
  });

  it('still includes non-excluded tags', () => {
    const games = [
      makeGame({ tags: ['Singleplayer', 'JRPG', 'Turn-Based'] }),
      makeGame({ tags: ['Singleplayer', 'JRPG'] }),
    ];
    const { topTags } = computeTagStats(games);
    expect(topTags.map((t) => t.tag)).toContain('JRPG');
  });
});

describe('useStats tag completion sorting', () => {
  it('ranks high-% tags with large sample above high-% tags with small sample', () => {
    // 1/3 = 33% with 3 games vs 5/10 = 50% with 10 games
    const games = [
      // 'Indie' tag: 5 finished out of 10 = 50%
      ...Array.from({ length: 5 }, () =>
        makeGame({ tags: ['Indie'], status: 'finished', finished_at: '2024-01-01' }),
      ),
      ...Array.from({ length: 5 }, () => makeGame({ tags: ['Indie'], status: 'backlog' })),
      // 'Roguelike' tag: 1 finished out of 3 = 33%
      makeGame({ tags: ['Roguelike'], status: 'finished', finished_at: '2024-01-01' }),
      makeGame({ tags: ['Roguelike'], status: 'backlog' }),
      makeGame({ tags: ['Roguelike'], status: 'backlog' }),
    ];
    const { tagCompletion } = computeTagStats(games);
    const tags = tagCompletion.map((t) => t.tag);
    expect(tags.indexOf('Indie')).toBeLessThan(tags.indexOf('Roguelike'));
  });

  it('ranks a tag with more finished games above one with fewer despite same %', () => {
    // Both 50% but different totals
    const games = [
      // 'RPG': 5/10 = 50%
      ...Array.from({ length: 5 }, () =>
        makeGame({ tags: ['RPG'], status: 'finished', finished_at: '2024-01-01' }),
      ),
      ...Array.from({ length: 5 }, () => makeGame({ tags: ['RPG'], status: 'backlog' })),
      // 'Puzzle': 2/4 = 50%
      ...Array.from({ length: 2 }, () =>
        makeGame({ tags: ['Puzzle'], status: 'finished', finished_at: '2024-01-01' }),
      ),
      ...Array.from({ length: 2 }, () => makeGame({ tags: ['Puzzle'], status: 'backlog' })),
    ];
    const { tagCompletion } = computeTagStats(games);
    const tags = tagCompletion.map((t) => t.tag);
    expect(tags.indexOf('RPG')).toBeLessThan(tags.indexOf('Puzzle'));
  });

  it('excludes tags with fewer than 3 games from completion', () => {
    const games = [
      makeGame({ tags: ['Rare'], status: 'finished', finished_at: '2024-01-01' }),
      makeGame({ tags: ['Rare'], status: 'finished', finished_at: '2024-01-01' }),
      // Only 2 games — below threshold
      ...Array.from({ length: 5 }, () =>
        makeGame({ tags: ['Common'], status: 'finished', finished_at: '2024-01-01' }),
      ),
    ];
    const { tagCompletion } = computeTagStats(games);
    expect(tagCompletion.map((t) => t.tag)).not.toContain('Rare');
    expect(tagCompletion.map((t) => t.tag)).toContain('Common');
  });
});

// ─── parseYear ────────────────────────────────────────────────────────────────

function parseYear(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const m = releaseDate.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

describe('parseYear', () => {
  it('extracts year from "Apr 21, 2021" format', () => {
    expect(parseYear('Apr 21, 2021')).toBe('2021');
  });

  it('extracts year from bare "2019" string', () => {
    expect(parseYear('2019')).toBe('2019');
  });

  it('extracts year from "Oct 2022" format', () => {
    expect(parseYear('Oct 2022')).toBe('2022');
  });

  it('extracts year from "Q4 2025" format', () => {
    expect(parseYear('Q4 2025')).toBe('2025');
  });

  it('returns null for null input', () => {
    expect(parseYear(null)).toBeNull();
  });

  it('returns null for unparseable string', () => {
    expect(parseYear('Coming Soon')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseYear('')).toBeNull();
  });
});

// ─── computeRatingDistribution ───────────────────────────────────────────────

function computeRatingDistribution(games: GameForStats[]) {
  const allRatedGames = games.filter((g) => g.rating !== null);
  return Array.from({ length: 11 }, (_, i) => ({
    rating: i,
    count: allRatedGames.filter((g) => g.rating === i).length,
  }));
}

describe('computeRatingDistribution', () => {
  it('always returns 11 buckets (0–10)', () => {
    const dist = computeRatingDistribution([]);
    expect(dist).toHaveLength(11);
    expect(dist[0].rating).toBe(0);
    expect(dist[10].rating).toBe(10);
  });

  it('counts ratings correctly across buckets', () => {
    const games = [
      makeGame({ rating: 8, status: 'finished' }),
      makeGame({ rating: 8, status: 'finished' }),
      makeGame({ rating: 7, status: 'finished' }),
    ];
    const dist = computeRatingDistribution(games);
    expect(dist[8].count).toBe(2);
    expect(dist[7].count).toBe(1);
    expect(dist[0].count).toBe(0);
  });

  it('includes ratings from non-finished games', () => {
    const games = [
      makeGame({ rating: 5, status: 'dropped' }),
      makeGame({ rating: 9, status: 'backlog' }),
    ];
    const dist = computeRatingDistribution(games);
    expect(dist[5].count).toBe(1);
    expect(dist[9].count).toBe(1);
  });

  it('ignores games with null rating', () => {
    const games = [makeGame({ rating: null }), makeGame({ rating: 7 })];
    const dist = computeRatingDistribution(games);
    const total = dist.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(1);
  });

  it('returns all zeros when no games are rated', () => {
    const dist = computeRatingDistribution([makeGame(), makeGame()]);
    expect(dist.every((b) => b.count === 0)).toBe(true);
  });
});

// ─── computeGamesByReleaseYear ────────────────────────────────────────────────

function computeGamesByReleaseYear(games: GameForStats[]) {
  const counts = new Map<string, number>();
  for (const game of games) {
    const year = parseYear(game.release_date);
    if (year) counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, count]) => ({ year, count }));
}

describe('computeGamesByReleaseYear', () => {
  it('groups games by parsed year', () => {
    const games = [
      makeGame({ release_date: 'Apr 21, 2021' }),
      makeGame({ release_date: 'Nov 5, 2021' }),
      makeGame({ release_date: '2022' }),
    ];
    const result = computeGamesByReleaseYear(games);
    const map = Object.fromEntries(result.map(({ year, count }) => [year, count]));
    expect(map['2021']).toBe(2);
    expect(map['2022']).toBe(1);
  });

  it('ignores games with null release_date', () => {
    const games = [makeGame({ release_date: null }), makeGame({ release_date: '2020' })];
    const result = computeGamesByReleaseYear(games);
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe('2020');
  });

  it('ignores games with unparseable release_date', () => {
    const games = [makeGame({ release_date: 'Coming Soon' }), makeGame({ release_date: '2021' })];
    const result = computeGamesByReleaseYear(games);
    expect(result).toHaveLength(1);
  });

  it('returns results sorted by year ascending', () => {
    const games = [
      makeGame({ release_date: '2022' }),
      makeGame({ release_date: '2019' }),
      makeGame({ release_date: '2021' }),
    ];
    const result = computeGamesByReleaseYear(games);
    expect(result.map((r) => r.year)).toEqual(['2019', '2021', '2022']);
  });

  it('returns empty array when no valid release dates', () => {
    const games = [makeGame({ release_date: null }), makeGame({ release_date: 'Coming Soon' })];
    expect(computeGamesByReleaseYear(games)).toHaveLength(0);
  });
});
