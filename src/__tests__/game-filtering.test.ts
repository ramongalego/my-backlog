import {
  isShortGameEligible,
  isWeekendGameEligible,
  isRandomPickEligible,
  GameForFiltering,
  SHORT_GAME_MIN_HOURS,
  SHORT_GAME_MAX_HOURS,
  WEEKEND_GAME_MIN_HOURS,
  WEEKEND_GAME_MAX_HOURS,
  MAX_PLAYTIME_MINUTES,
} from '@/lib/games/filtering';

describe('isShortGameEligible', () => {
  const baseEligibleGame: GameForFiltering = {
    type: 'game',
    status: 'backlog',
    main_story_hours: 3,
    playtime_forever: 60,
    categories: ['Single-player'],
    steam_review_weighted: 85,
  };

  it('should return true for a fully eligible short game', () => {
    expect(isShortGameEligible(baseEligibleGame)).toBe(true);
  });

  describe('type validation', () => {
    it('should return false for DLC', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, type: 'dlc' })).toBe(false);
    });

    it('should return false for software', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, type: 'software' })).toBe(false);
    });

    it('should return false for null type', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, type: null })).toBe(false);
    });
  });

  describe('hours validation', () => {
    it('should return false for games under 1 hour', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, main_story_hours: 0.5 })).toBe(false);
    });

    it('should return true for exactly 1 hour', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, main_story_hours: 1 })).toBe(true);
    });

    it('should return true for exactly 5 hours', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, main_story_hours: 5 })).toBe(true);
    });

    it('should return false for over 5 hours', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, main_story_hours: 5.1 })).toBe(false);
    });

    it('should return false when main_story_hours is null', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, main_story_hours: null })).toBe(false);
    });
  });

  describe('playtime validation', () => {
    it('should return true for games with no playtime', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, playtime_forever: 0 })).toBe(true);
    });

    it('should return true for games at max playtime (240 min)', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, playtime_forever: 240 })).toBe(true);
    });

    it('should return false for games over max playtime', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, playtime_forever: 241 })).toBe(false);
    });

    it('should return true when playtime is null', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, playtime_forever: null })).toBe(true);
    });
  });

  describe('category validation', () => {
    it('should return false for multiplayer-only games', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, categories: ['Multi-player'] })).toBe(false);
    });

    it('should return true for games with both single and multiplayer', () => {
      expect(isShortGameEligible({
        ...baseEligibleGame,
        categories: ['Single-player', 'Multi-player'],
      })).toBe(true);
    });

    it('should return false for games with null categories', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, categories: null })).toBe(false);
    });

    it('should return false for games with empty categories', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, categories: [] })).toBe(false);
    });
  });

  describe('status validation', () => {
    it('should return true for backlog status', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, status: 'backlog' })).toBe(true);
    });

    it('should return true for null status (new games)', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, status: null })).toBe(true);
    });

    it('should return false for playing status', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, status: 'playing' })).toBe(false);
    });

    it('should return false for finished status', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, status: 'finished' })).toBe(false);
    });

    it('should return false for dropped status', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, status: 'dropped' })).toBe(false);
    });

    it('should return false for hidden status', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, status: 'hidden' })).toBe(false);
    });
  });

  describe('review score validation', () => {
    it('should return false when steam_review_weighted is null', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, steam_review_weighted: null })).toBe(false);
    });

    it('should return true for any numeric review score', () => {
      expect(isShortGameEligible({ ...baseEligibleGame, steam_review_weighted: 0 })).toBe(true);
      expect(isShortGameEligible({ ...baseEligibleGame, steam_review_weighted: 100 })).toBe(true);
    });
  });
});

describe('isWeekendGameEligible', () => {
  const baseEligibleGame: GameForFiltering = {
    type: 'game',
    status: 'backlog',
    main_story_hours: 8,
    playtime_forever: 60,
    categories: ['Single-player'],
    steam_review_weighted: 85,
  };

  it('should return true for a fully eligible weekend game', () => {
    expect(isWeekendGameEligible(baseEligibleGame)).toBe(true);
  });

  describe('hours validation', () => {
    it('should return false for exactly 5 hours (belongs to short games)', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, main_story_hours: 5 })).toBe(false);
    });

    it('should return true for just over 5 hours', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, main_story_hours: 5.1 })).toBe(true);
    });

    it('should return true for exactly 12 hours', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, main_story_hours: 12 })).toBe(true);
    });

    it('should return false for over 12 hours', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, main_story_hours: 12.1 })).toBe(false);
    });

    it('should return false when main_story_hours is null', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, main_story_hours: null })).toBe(false);
    });
  });

  describe('type validation', () => {
    it('should return false for DLC', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, type: 'dlc' })).toBe(false);
    });
  });

  describe('playtime validation', () => {
    it('should return true for games at max playtime', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, playtime_forever: 240 })).toBe(true);
    });

    it('should return false for games over max playtime', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, playtime_forever: 241 })).toBe(false);
    });
  });

  describe('category validation', () => {
    it('should return false for multiplayer-only games', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, categories: ['Multi-player'] })).toBe(false);
    });
  });

  describe('status validation', () => {
    it('should return false for finished games', () => {
      expect(isWeekendGameEligible({ ...baseEligibleGame, status: 'finished' })).toBe(false);
    });
  });
});

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
