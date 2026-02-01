import {
  isMetadataFresh,
  calculateBayesianScore,
  METADATA_FRESHNESS_DAYS,
} from '@/lib/games/scoring';

describe('isMetadataFresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return true for metadata synced today', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.setSystemTime(now);

    const syncedAt = new Date('2024-01-15T10:00:00Z').toISOString();
    expect(isMetadataFresh(syncedAt)).toBe(true);
  });

  it('should return true for metadata synced 6 days ago', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.setSystemTime(now);

    const sixDaysAgo = new Date('2024-01-09T12:00:00Z').toISOString();
    expect(isMetadataFresh(sixDaysAgo)).toBe(true);
  });

  it('should return false for metadata synced exactly 7 days ago', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.setSystemTime(now);

    const sevenDaysAgo = new Date('2024-01-08T12:00:00Z').toISOString();
    expect(isMetadataFresh(sevenDaysAgo)).toBe(false);
  });

  it('should return false for metadata synced 8 days ago', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.setSystemTime(now);

    const eightDaysAgo = new Date('2024-01-07T12:00:00Z').toISOString();
    expect(isMetadataFresh(eightDaysAgo)).toBe(false);
  });

  it('should handle boundary case just under 7 days', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.setSystemTime(now);

    // 6 days, 23 hours, 59 minutes ago - should be fresh
    const justUnder = new Date('2024-01-08T12:01:00Z').toISOString();
    expect(isMetadataFresh(justUnder)).toBe(true);
  });

  it('should handle very old metadata', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.setSystemTime(now);

    const oneYearAgo = new Date('2023-01-15T12:00:00Z').toISOString();
    expect(isMetadataFresh(oneYearAgo)).toBe(false);
  });

  it('should confirm METADATA_FRESHNESS_DAYS constant is 7', () => {
    expect(METADATA_FRESHNESS_DAYS).toBe(7);
  });
});

describe('calculateBayesianScore', () => {
  it('should weight heavily toward global average (70) for games with 1 review', () => {
    // With 1 review at 100%: (1/101)*100 + (100/101)*70 ≈ 70.3
    const score = calculateBayesianScore(100, 1);
    expect(score).toBe(70); // Rounds to 70
  });

  it('should be balanced for games with 100 reviews', () => {
    // With 100 reviews at 90%: (100/200)*90 + (100/200)*70 = 45 + 35 = 80
    const score = calculateBayesianScore(90, 100);
    expect(score).toBe(80);
  });

  it('should weight heavily toward actual score for games with many reviews', () => {
    // With 10000 reviews at 95%: (10000/10100)*95 + (100/10100)*70 ≈ 94.8
    const score = calculateBayesianScore(95, 10000);
    expect(score).toBe(95);
  });

  it('should handle very low scores correctly', () => {
    // With 100 reviews at 20%: (100/200)*20 + (100/200)*70 = 10 + 35 = 45
    const score = calculateBayesianScore(20, 100);
    expect(score).toBe(45);
  });

  it('should handle zero reviews edge case', () => {
    // With 0 reviews at any score: (0/100)*score + (100/100)*70 = 70
    const score = calculateBayesianScore(50, 0);
    expect(score).toBe(70);
  });

  it('should round to nearest integer', () => {
    // (50/150)*85 + (100/150)*70 = 28.33 + 46.67 = 75
    const score = calculateBayesianScore(85, 50);
    expect(score).toBe(75);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('should handle exact global average score', () => {
    // When actual score equals global average, result should be 70 regardless of count
    const score1 = calculateBayesianScore(70, 1);
    const score2 = calculateBayesianScore(70, 100);
    const score3 = calculateBayesianScore(70, 10000);

    expect(score1).toBe(70);
    expect(score2).toBe(70);
    expect(score3).toBe(70);
  });

  it('should return higher weighted scores for better reviewed games with same count', () => {
    const goodScore = calculateBayesianScore(90, 100);
    const badScore = calculateBayesianScore(50, 100);

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it('should increase weighted score as review count increases for high-rated games', () => {
    // A 90% game should have higher weighted score with more reviews
    const fewReviews = calculateBayesianScore(90, 10);
    const manyReviews = calculateBayesianScore(90, 1000);

    expect(manyReviews).toBeGreaterThan(fewReviews);
  });

  it('should decrease weighted score as review count increases for low-rated games', () => {
    // A 30% game should have lower weighted score with more reviews
    const fewReviews = calculateBayesianScore(30, 10);
    const manyReviews = calculateBayesianScore(30, 1000);

    expect(manyReviews).toBeLessThan(fewReviews);
  });
});
