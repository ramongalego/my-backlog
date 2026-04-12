import { buildSuggestionPrompt, parseAIResponse } from '@/lib/suggest/prompt';
import type { SuggestionContext, GameForSuggestion, FinishedGame } from '@/lib/suggest/types';

describe('buildSuggestionPrompt', () => {
  const createGame = (overrides: Partial<GameForSuggestion> = {}): GameForSuggestion => ({
    app_id: 1,
    name: 'Test Game',
    genres: ['Action', 'Adventure'],
    categories: ['Single-player'],
    tags: null,
    main_story_hours: 10,
    playtime_forever: 60,
    steam_review_weighted: 85,
    reroll_count: 0,
    ...overrides,
  });

  const baseContext: SuggestionContext = {
    preferences: {
      mood: 'adrenaline',
      energy: 'high',
      time: 'medium',
    },
    backlogGames: [
      createGame({ app_id: 1, name: 'Game One' }),
      createGame({ app_id: 2, name: 'Game Two' }),
    ],
    finishedGames: [{ name: 'Completed Game', rating: 9 }] as FinishedGame[],
    droppedGames: ['Dropped Game'],
    excludeAppIds: new Set<number>(),
    previousReasonings: [],
    tagAffinities: [],
  };

  it('should include user preferences in prompt', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('fast, demanding, focus-heavy');
    expect(prompt).toContain('complex systems to learn');
    expect(prompt).toContain('5-12 hours total');
  });

  it('should include game list in prompt', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Game One');
    expect(prompt).toContain('Game Two');
    expect(prompt).toContain('ID: 1');
    expect(prompt).toContain('ID: 2');
  });

  it('should include game details', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Genres: Action, Adventure');
    expect(prompt).toContain('Length: 10h');
    expect(prompt).toContain('Rating: 85%');
  });

  it('should indicate already played time', () => {
    const context: SuggestionContext = {
      ...baseContext,
      backlogGames: [createGame({ playtime_forever: 120 })],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('Already played: 2h');
  });

  it('should indicate never played games', () => {
    const context: SuggestionContext = {
      ...baseContext,
      backlogGames: [createGame({ playtime_forever: 0 })],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('Never played');
  });

  it('should include reroll count when present', () => {
    const context: SuggestionContext = {
      ...baseContext,
      backlogGames: [createGame({ reroll_count: 3 })],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('Skipped 3 times before');
  });

  it('should include finished games context', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Completed Game');
    expect(prompt).toContain('FINISHED');
  });

  it('should include dropped games context', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Dropped Game');
    expect(prompt).toContain('DROPPED');
  });

  it('should include sequel/series priority instruction', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Sequels and series come first');
  });

  it('should include single-player preference instruction', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Prefer single-player games');
  });

  it('should exclude games in excludeAppIds', () => {
    const context: SuggestionContext = {
      ...baseContext,
      excludeAppIds: new Set([1]),
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).not.toContain('Game One');
    expect(prompt).toContain('Game Two');
  });

  it('should throw if no eligible games after exclusions', () => {
    const context: SuggestionContext = {
      ...baseContext,
      excludeAppIds: new Set([1, 2]),
    };

    expect(() => buildSuggestionPrompt(context)).toThrow('No eligible games to suggest');
  });

  it('should handle all mood types', () => {
    const moods = ['adrenaline', 'relaxed', 'engaged', 'emotional'] as const;

    moods.forEach((mood) => {
      const context: SuggestionContext = {
        ...baseContext,
        preferences: { ...baseContext.preferences, mood },
      };

      expect(() => buildSuggestionPrompt(context)).not.toThrow();
    });
  });

  it('should request JSON response format', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('app_id');
    expect(prompt).toContain('reasoning');
    expect(prompt).toContain('JSON');
  });

  it('should include previous reasonings when provided', () => {
    const context: SuggestionContext = {
      ...baseContext,
      previousReasonings: ['Since you loved Dark Souls, this game fits perfectly.'],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('AVOID REPETITION');
    expect(prompt).toContain('Since you loved Dark Souls');
  });

  it('should not include repetition warning when no previous reasonings', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).not.toContain('AVOID REPETITION');
  });

  it('should include tags in game entry when present', () => {
    const context: SuggestionContext = {
      ...baseContext,
      backlogGames: [
        createGame({ tags: ['Story Rich', 'RPG', 'Atmospheric', 'Action', 'Adventure'] }),
      ],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('Tags: Story Rich, RPG, Atmospheric, Action, Adventure');
  });

  it('should cap tags at 5 per game', () => {
    const context: SuggestionContext = {
      ...baseContext,
      backlogGames: [
        createGame({
          tags: ['Story Rich', 'RPG', 'Atmospheric', 'Action', 'Adventure', 'Open World', 'Dark'],
        }),
      ],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('Tags: Story Rich, RPG, Atmospheric, Action, Adventure');
    expect(prompt).not.toContain('Open World');
    expect(prompt).not.toContain('Dark');
  });

  it('should omit tags field when game has no tags', () => {
    const context: SuggestionContext = {
      ...baseContext,
      backlogGames: [createGame({ tags: null })],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).not.toContain('Tags:');
  });

  it('should include tag affinities section when affinities are present', () => {
    const context: SuggestionContext = {
      ...baseContext,
      tagAffinities: [
        { tag: 'Story Rich', completionRate: 0.8, finished: 8, total: 10 },
        { tag: 'RPG', completionRate: 0.67, finished: 4, total: 6 },
      ],
    };

    const prompt = buildSuggestionPrompt(context);

    expect(prompt).toContain('TAG AFFINITIES');
    expect(prompt).toContain('Story Rich: finished 8/10 games (80%)');
    expect(prompt).toContain('RPG: finished 4/6 games (67%)');
  });

  it('should omit tag affinities section when no affinities', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).not.toContain('TAG AFFINITIES');
  });
});

describe('parseAIResponse', () => {
  it('should parse valid JSON response', () => {
    const response = '{"app_id": 123, "reasoning": "This game matches your mood."}';

    const result = parseAIResponse(response);

    expect(result.app_id).toBe(123);
    expect(result.reasoning).toBe('This game matches your mood.');
  });

  it('should extract JSON from markdown code block', () => {
    const response = `Here's my recommendation:
\`\`\`json
{"app_id": 456, "reasoning": "Great choice for chill vibes."}
\`\`\``;

    const result = parseAIResponse(response);

    expect(result.app_id).toBe(456);
    expect(result.reasoning).toBe('Great choice for chill vibes.');
  });

  it('should extract JSON with surrounding text', () => {
    const response = `Based on your preferences, I recommend:
{"app_id": 789, "reasoning": "Perfect for your energy level."}
Enjoy gaming!`;

    const result = parseAIResponse(response);

    expect(result.app_id).toBe(789);
  });

  it('should throw on missing JSON', () => {
    const response = 'I recommend Game XYZ because it matches your mood.';

    expect(() => parseAIResponse(response)).toThrow('No valid JSON found');
  });

  it('should throw on invalid app_id type', () => {
    const response = '{"app_id": "not-a-number", "reasoning": "Test"}';

    expect(() => parseAIResponse(response)).toThrow('Invalid app_id');
  });

  it('should throw on non-integer app_id', () => {
    const response = '{"app_id": 123.45, "reasoning": "Test"}';

    expect(() => parseAIResponse(response)).toThrow('Invalid app_id');
  });

  it('should throw on missing reasoning', () => {
    const response = '{"app_id": 123}';

    expect(() => parseAIResponse(response)).toThrow('Invalid reasoning');
  });

  it('should throw on empty reasoning', () => {
    const response = '{"app_id": 123, "reasoning": ""}';

    expect(() => parseAIResponse(response)).toThrow('Invalid reasoning');
  });
});
