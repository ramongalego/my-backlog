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
