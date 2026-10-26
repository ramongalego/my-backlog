import { buildSuggestionPrompt, parseAIResponse } from '@/lib/suggest/prompt';
import type { ScoredCandidate } from '@/lib/suggest/shortlist';
import type { SuggestionContext, GameForSuggestion } from '@/lib/suggest/types';

describe('buildSuggestionPrompt', () => {
  const createGame = (overrides: Partial<GameForSuggestion> = {}): GameForSuggestion => ({
    id: 1,
    name: 'Test Game',
    genres: ['Action', 'Adventure'],
    categories: ['Single-player'],
    tags: null,
    main_story_hours: 10,
    playtime_forever: 60,
    steam_review_score: 92,
    steam_review_count: 12439,
    steam_review_weighted: 85,
    reroll_count: 0,
    last_rerolled_at: null,
    ...overrides,
  });

  const candidate = (
    game: Partial<GameForSuggestion> = {},
    extra: Partial<ScoredCandidate<GameForSuggestion>> = {},
  ): ScoredCandidate<GameForSuggestion> => ({
    game: createGame(game),
    score: 1,
    series: null,
    similarTo: [],
    similarToDropped: null,
    recentlySkipped: false,
    outsideTimeRange: false,
    ...extra,
  });

  const baseContext: SuggestionContext = {
    preferences: {
      mood: 'adrenaline',
      energy: 'high',
      time: 'medium',
    },
    candidates: [candidate({ id: 1, name: 'Game One' }), candidate({ id: 2, name: 'Game Two' })],
    finishedGames: [{ name: 'Completed Game', rating: 9 }],
    droppedGames: ['Dropped Game'],
    previousReasonings: [],
  };

  const withCandidates = (...candidates: ScoredCandidate<GameForSuggestion>[]) =>
    buildSuggestionPrompt({ ...baseContext, candidates });

  it('includes the chosen mood, energy and time', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('fast, demanding, focus-heavy');
    expect(prompt).toContain('complex systems to learn');
    expect(prompt).toContain('5-15 hours total');
  });

  it('lists every shortlisted game with its ID', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('"Game One" (ID: 1)');
    expect(prompt).toContain('"Game Two" (ID: 2)');
    expect(prompt).toContain('SHORTLIST (2 games');
  });

  it('includes game details', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Genres: Action, Adventure');
    expect(prompt).toContain('Length: 10h');
    expect(prompt).toContain('Steam reviews: 92% positive of 12,439');
  });

  it('says when the length is unknown', () => {
    expect(withCandidates(candidate({ main_story_hours: null }))).toContain('Length: unknown');
  });

  it('shows playtime, or that the game is untouched', () => {
    expect(withCandidates(candidate({ playtime_forever: 120 }))).toContain('Already played: 2h');
    expect(withCandidates(candidate({ playtime_forever: 0 }))).toContain('Never played');
  });

  it('caps tags at 6 per game and omits the field when there are none', () => {
    const prompt = withCandidates(
      candidate({
        tags: ['Story Rich', 'RPG', 'Atmospheric', 'Action', 'Adventure', 'Open World', 'Dark'],
      }),
    );
    expect(prompt).toContain('Tags: Story Rich, RPG, Atmospheric, Action, Adventure, Open World');
    expect(prompt).not.toContain('Open World, Dark');

    expect(withCandidates(candidate({ tags: null }))).not.toContain('Tags:');
  });

  it('spells out series and taste signals', () => {
    const prompt = withCandidates(
      candidate(
        { name: 'Saga IV' },
        {
          series: { name: 'Saga III', status: 'finished', rating: 9, tags: null },
          similarTo: [
            { name: 'Other RPG', status: 'finished', rating: 8, tags: null },
            { name: 'Unrated RPG', status: 'finished', rating: null, tags: null },
          ],
          similarToDropped: { name: 'Boring RPG', status: 'dropped', rating: null, tags: null },
        },
      ),
    );

    expect(prompt).toContain('Series: you finished "Saga III" (9/10)');
    expect(prompt).toContain('Plays like: "Other RPG" (8/10), "Unrated RPG"');
    expect(prompt).toContain('Plays like a game you dropped: "Boring RPG"');
  });

  it('marks the top-scoring games', () => {
    const prompt = withCandidates(
      candidate({ id: 1, name: 'Best' }, { score: 8 }),
      candidate({ id: 2, name: 'Close' }, { score: 7 }),
      candidate({ id: 3, name: 'Far' }, { score: 3 }),
    );
    expect(prompt).toContain('"Best" (ID: 1) | TOP MATCH');
    expect(prompt).toContain('"Close" (ID: 2) | TOP MATCH');
    expect(prompt).not.toContain('"Far" (ID: 3) | TOP MATCH');
  });

  it('flags recent skips and games outside the time range', () => {
    const prompt = withCandidates(candidate({}, { recentlySkipped: true, outsideTimeRange: true }));

    expect(prompt).toContain('Skipped recently');
    expect(prompt).toContain('Outside the time they asked for');
  });

  it('includes finished and dropped games', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('Loved (8-10/10): Completed Game (9/10)');
    expect(prompt).toContain('**Dropped** (lost interest): Dropped Game');
  });

  it('puts series continuations first', () => {
    expect(buildSuggestionPrompt(baseContext)).toContain('Continuing a series they rated highly');
  });

  it('throws when the shortlist is empty', () => {
    expect(() => withCandidates()).toThrow('No eligible games to suggest');
  });

  it('handles every mood', () => {
    for (const mood of ['adrenaline', 'relaxed', 'engaged', 'emotional'] as const) {
      expect(() =>
        buildSuggestionPrompt({
          ...baseContext,
          preferences: { ...baseContext.preferences, mood },
        }),
      ).not.toThrow();
    }
  });

  it('asks for JSON with game_id and reasoning', () => {
    const prompt = buildSuggestionPrompt(baseContext);

    expect(prompt).toContain('"game_id"');
    expect(prompt).toContain('"reasoning"');
    expect(prompt).toContain('JSON');
  });

  it('includes previous reasonings only after a reroll', () => {
    expect(buildSuggestionPrompt(baseContext)).not.toContain('AVOID REPETITION');

    const prompt = buildSuggestionPrompt({
      ...baseContext,
      previousReasonings: ['Since you loved Dark Souls, this game fits perfectly.'],
    });
    expect(prompt).toContain('AVOID REPETITION');
    expect(prompt).toContain('Since you loved Dark Souls');
  });
});

describe('parseAIResponse', () => {
  it('should parse valid JSON response', () => {
    const response = '{"game_id": 123, "reasoning": "This game matches your mood."}';

    const result = parseAIResponse(response);

    expect(result.game_id).toBe(123);
    expect(result.reasoning).toBe('This game matches your mood.');
  });

  it('should extract JSON from markdown code block', () => {
    const response = `Here's my recommendation:
\`\`\`json
{"game_id": 456, "reasoning": "Great choice for chill vibes."}
\`\`\``;

    const result = parseAIResponse(response);

    expect(result.game_id).toBe(456);
    expect(result.reasoning).toBe('Great choice for chill vibes.');
  });

  it('should extract JSON with surrounding text', () => {
    const response = `Based on your preferences, I recommend:
{"game_id": 789, "reasoning": "Perfect for your energy level."}
Enjoy gaming!`;

    const result = parseAIResponse(response);

    expect(result.game_id).toBe(789);
  });

  it('should throw on missing JSON', () => {
    const response = 'I recommend Game XYZ because it matches your mood.';

    expect(() => parseAIResponse(response)).toThrow('No valid JSON found');
  });

  it('should throw on invalid game_id type', () => {
    const response = '{"game_id": "not-a-number", "reasoning": "Test"}';

    expect(() => parseAIResponse(response)).toThrow('Invalid game_id');
  });

  it('should throw on non-integer game_id', () => {
    const response = '{"game_id": 123.45, "reasoning": "Test"}';

    expect(() => parseAIResponse(response)).toThrow('Invalid game_id');
  });

  it('should throw on missing reasoning', () => {
    const response = '{"game_id": 123}';

    expect(() => parseAIResponse(response)).toThrow('Invalid reasoning');
  });

  it('should throw on empty reasoning', () => {
    const response = '{"game_id": 123, "reasoning": ""}';

    expect(() => parseAIResponse(response)).toThrow('Invalid reasoning');
  });
});
