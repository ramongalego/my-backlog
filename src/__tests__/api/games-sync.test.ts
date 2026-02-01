import {
  validateSyncInput,
  shouldSkipEnrichment,
  getEnrichmentStrategy,
} from '@/lib/games/sync-validation';
import { isMetadataFresh, calculateBayesianScore } from '@/lib/games/scoring';

describe('validateSyncInput', () => {
  describe('appId validation', () => {
    it('should reject missing appId', () => {
      const result = validateSyncInput({ appId: undefined });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject null appId', () => {
      const result = validateSyncInput({ appId: null });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject non-number appId', () => {
      const result = validateSyncInput({ appId: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject zero appId', () => {
      const result = validateSyncInput({ appId: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject negative appId', () => {
      const result = validateSyncInput({ appId: -5 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject float appId', () => {
      const result = validateSyncInput({ appId: 123.5 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should accept valid positive integer appId', () => {
      const result = validateSyncInput({ appId: 730 });
      expect(result.valid).toBe(true);
      expect(result.appId).toBe(730);
    });

    it('should accept large appId values', () => {
      const result = validateSyncInput({ appId: 2147483647 });
      expect(result.valid).toBe(true);
      expect(result.appId).toBe(2147483647);
    });
  });
});

describe('shouldSkipEnrichment', () => {
  it('should return false for game type', () => {
    expect(shouldSkipEnrichment('game')).toBe(false);
  });

  it('should return true for DLC type', () => {
    expect(shouldSkipEnrichment('dlc')).toBe(true);
  });

  it('should return true for software type', () => {
    expect(shouldSkipEnrichment('software')).toBe(true);
  });

  it('should return true for null type', () => {
    expect(shouldSkipEnrichment(null)).toBe(true);
  });

  it('should return true for unknown types', () => {
    expect(shouldSkipEnrichment('demo')).toBe(true);
    expect(shouldSkipEnrichment('mod')).toBe(true);
    expect(shouldSkipEnrichment('video')).toBe(true);
  });
});

describe('getEnrichmentStrategy', () => {
  it('should enable all enrichment for games', () => {
    const strategy = getEnrichmentStrategy('game');
    expect(strategy.fetchHLTB).toBe(true);
    expect(strategy.fetchSteamReviews).toBe(true);
  });

  it('should disable enrichment for DLC', () => {
    const strategy = getEnrichmentStrategy('dlc');
    expect(strategy.fetchHLTB).toBe(false);
    expect(strategy.fetchSteamReviews).toBe(false);
  });

  it('should disable enrichment for software', () => {
    const strategy = getEnrichmentStrategy('software');
    expect(strategy.fetchHLTB).toBe(false);
    expect(strategy.fetchSteamReviews).toBe(false);
  });

  it('should disable enrichment for null type', () => {
    const strategy = getEnrichmentStrategy(null);
    expect(strategy.fetchHLTB).toBe(false);
    expect(strategy.fetchSteamReviews).toBe(false);
  });
});

describe('sync route behavior (integration)', () => {
  describe('cache behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should consider metadata fresh within 7 days', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      jest.setSystemTime(now);

      // 3 days ago - should be fresh
      const threeDaysAgo = new Date('2024-01-12T12:00:00Z').toISOString();
      expect(isMetadataFresh(threeDaysAgo)).toBe(true);
    });

    it('should consider metadata stale after 7 days', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      jest.setSystemTime(now);

      // 8 days ago - should be stale
      const eightDaysAgo = new Date('2024-01-07T12:00:00Z').toISOString();
      expect(isMetadataFresh(eightDaysAgo)).toBe(false);
    });
  });

  describe('weighted score calculation', () => {
    it('should calculate weighted score for games with 100 reviews at 90%', () => {
      // (100/200)*90 + (100/200)*70 = 45 + 35 = 80
      const score = calculateBayesianScore(90, 100);
      expect(score).toBe(80);
    });

    it('should calculate weighted score for games with few reviews', () => {
      // With 10 reviews at 100%: (10/110)*100 + (100/110)*70 ≈ 72.7
      const score = calculateBayesianScore(100, 10);
      expect(score).toBe(73);
    });

    it('should calculate weighted score for games with many reviews', () => {
      // With 1000 reviews at 95%: (1000/1100)*95 + (100/1100)*70 ≈ 92.7
      const score = calculateBayesianScore(95, 1000);
      expect(score).toBe(93);
    });

    it('should return global average for zero reviews', () => {
      const score = calculateBayesianScore(50, 0);
      expect(score).toBe(70);
    });
  });

  describe('game type handling', () => {
    it('should fetch HLTB and reviews only for actual games', () => {
      expect(getEnrichmentStrategy('game').fetchHLTB).toBe(true);
      expect(getEnrichmentStrategy('game').fetchSteamReviews).toBe(true);
    });

    it('should skip HLTB and reviews for DLC', () => {
      expect(getEnrichmentStrategy('dlc').fetchHLTB).toBe(false);
      expect(getEnrichmentStrategy('dlc').fetchSteamReviews).toBe(false);
    });

    it('should skip HLTB and reviews for software', () => {
      expect(getEnrichmentStrategy('software').fetchHLTB).toBe(false);
      expect(getEnrichmentStrategy('software').fetchSteamReviews).toBe(false);
    });
  });
});
