import { syncSingleRequestSchema } from '@/lib/validations/common';
import { isMetadataFresh, calculateBayesianScore } from '@/lib/games/scoring';

// The sync route validates its input with `syncSingleRequestSchema` (zod) and
// decides metadata enrichment via the inline `type === 'game'` check in
// metadata-fetch. These tests exercise that real validation contract — the
// route's source of truth — rather than a parallel reimplementation.
describe('syncSingleRequestSchema (sync route input validation)', () => {
  describe('appId validation', () => {
    it('should reject missing appId', () => {
      expect(syncSingleRequestSchema.safeParse({}).success).toBe(false);
    });

    it('should reject null appId', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: null }).success).toBe(false);
    });

    it('should reject non-number appId', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: 'abc' }).success).toBe(false);
    });

    it('should reject zero appId', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: 0 }).success).toBe(false);
    });

    it('should reject negative appId', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: -5 }).success).toBe(false);
    });

    it('should reject float appId', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: 123.5 }).success).toBe(false);
    });

    it('should accept valid positive integer appId', () => {
      const result = syncSingleRequestSchema.safeParse({ appId: 730 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.appId).toBe(730);
    });

    it('should accept large appId values', () => {
      const result = syncSingleRequestSchema.safeParse({ appId: 2147483647 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.appId).toBe(2147483647);
    });
  });

  describe('name hint', () => {
    it('should accept an optional name', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: 730, name: 'CS2' }).success).toBe(true);
    });

    it('should reject an empty name', () => {
      expect(syncSingleRequestSchema.safeParse({ appId: 730, name: '' }).success).toBe(false);
    });
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

    it('should consider metadata fresh within 90 days', () => {
      const now = new Date('2026-05-01T12:00:00Z');
      jest.setSystemTime(now);

      // 60 days ago - should be fresh
      const sixtyDaysAgo = new Date('2026-03-02T12:00:00Z').toISOString();
      expect(isMetadataFresh(sixtyDaysAgo)).toBe(true);
    });

    it('should consider metadata stale after 90 days', () => {
      const now = new Date('2026-06-15T12:00:00Z');
      jest.setSystemTime(now);

      // 91 days ago - should be stale
      const ninetyOneDaysAgo = new Date('2026-03-16T12:00:00Z').toISOString();
      expect(isMetadataFresh(ninetyOneDaysAgo)).toBe(false);
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
});
