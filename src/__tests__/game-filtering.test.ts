import {
  isRandomPickEligible,
  GameForFiltering,
  SHORT_GAME_MIN_HOURS,
  SHORT_GAME_MAX_HOURS,
  WEEKEND_GAME_MIN_HOURS,
  WEEKEND_GAME_MAX_HOURS,
  MAX_PLAYTIME_MINUTES,
} from '@/lib/games/filtering';

describe('isRandomPickEligible', () => {
  const baseEligibleGame: GameForFiltering = {
    type: 'game',
    status: 'backlog',
    main_story_hours: 10,
    playtime_forever: 60,
    categories: ['Single-player'],
  };

  it('should return true for a fully eligible game', () => {
    expect(isRandomPickEligible(baseEligibleGame)).toBe(true);
  });

  describe('playtime validation (stricter than pool filters)', () => {
    it('should return true for games with 2 hours playtime (120 min)', () => {
      expect(isRandomPickEligible({ ...baseEligibleGame, playtime_forever: 120 })).toBe(true);
    });

    it('should return false for games over 2 hours playtime', () => {
      expect(isRandomPickEligible({ ...baseEligibleGame, playtime_forever: 121 })).toBe(false);
    });
  });

  it('should not require steam_review_weighted (unlike pool filters)', () => {
    expect(isRandomPickEligible({ ...baseEligibleGame, steam_review_weighted: null })).toBe(true);
  });

  it('should accept any main_story_hours value', () => {
    expect(isRandomPickEligible({ ...baseEligibleGame, main_story_hours: 100 })).toBe(true);
  });
});

describe('constants', () => {
  it('should have correct short game boundaries', () => {
    expect(SHORT_GAME_MIN_HOURS).toBe(1);
    expect(SHORT_GAME_MAX_HOURS).toBe(5);
  });

  it('should have correct weekend game boundaries', () => {
    expect(WEEKEND_GAME_MIN_HOURS).toBe(5);
    expect(WEEKEND_GAME_MAX_HOURS).toBe(12);
  });

  it('should have short and weekend games connect at 5 hours', () => {
    expect(SHORT_GAME_MAX_HOURS).toBe(WEEKEND_GAME_MIN_HOURS);
  });

  it('should have correct max playtime', () => {
    expect(MAX_PLAYTIME_MINUTES).toBe(240);
  });
});
