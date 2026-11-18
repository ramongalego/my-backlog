import { queueAddRequestSchema, safeText, syncSingleRequestSchema } from '@/lib/validations/common';
import { isMetadataFresh, calculateBayesianScore } from '@/lib/games/scoring';

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

describe('queueAddRequestSchema (adding a game to the queue)', () => {
  it('takes the game alone: an ordinary add says no time', () => {
    const result = queueAddRequestSchema.safeParse({ gameId: 7 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ gameId: 7 });
    expect(result.data).not.toHaveProperty('undoAgoMs');
  });

  it.each([0, 1, 90_000, 7 * 24 * 60 * 60 * 1000])(
    'accepts %d for how long ago an Undo took the game off',
    (undoAgoMs) => {
      const result = queueAddRequestSchema.safeParse({ gameId: 7, undoAgoMs });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ gameId: 7, undoAgoMs });
    },
  );

  it.each([
    ['a negative time', -1],
    ['a number sent as text', '90000'],
    ['text', 'a while ago'],
    ['null', null],
  ])('rejects %s for how long ago that was', (_, undoAgoMs) => {
    expect(queueAddRequestSchema.safeParse({ gameId: 7, undoAgoMs }).success).toBe(false);
  });

  it.each([
    ['no game', { undoAgoMs: 90_000 }],
    ['a game id that is not one', { gameId: 0, undoAgoMs: 90_000 }],
  ])('still rejects %s', (_, body) => {
    expect(queueAddRequestSchema.safeParse(body).success).toBe(false);
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

      const sixtyDaysAgo = new Date('2026-03-02T12:00:00Z').toISOString();
      expect(isMetadataFresh(sixtyDaysAgo)).toBe(true);
    });

    it('should consider metadata stale after 90 days', () => {
      const now = new Date('2026-06-15T12:00:00Z');
      jest.setSystemTime(now);

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

describe('safeText (notes, console names, support messages)', () => {
  const clean = (text: string) => safeText.parse(text);

  it('takes HTML tags out', () => {
    expect(clean('<b>Loved</b> it<br/>')).toBe('Loved it');
    expect(clean('<img src=x onerror=alert(1)> hi')).toBe('hi');
    expect(clean('<script>alert(1)</script>')).toBe('alert(1)');
    expect(clean('a <!-- hidden --> b')).toBe('a  b');
  });

  it("keeps a sentence's own < and >: a heart, a comparison", () => {
    expect(clean('I <3 this. Arkham City > Asylum, fight me')).toBe(
      'I <3 this. Arkham City > Asylum, fight me',
    );
    expect(clean('combat < story, and 2 > 1')).toBe('combat < story, and 2 > 1');
    expect(clean('>>> best of the year <<<')).toBe('>>> best of the year <<<');
  });

  it("can't be left with a tag by nesting one in another", () => {
    expect(clean('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toMatch(/<\/?[a-z]/i);
  });

  it('trims the ends', () => {
    expect(clean('  Switch 2  ')).toBe('Switch 2');
  });
});
