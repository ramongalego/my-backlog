import { gameStatusSchema } from '@/lib/validations/games';

describe('gameStatusSchema', () => {
  const valid = { appId: 730, status: 'playing' as const };

  describe('appId', () => {
    it('rejects missing appId', () => {
      expect(gameStatusSchema.safeParse({ status: 'playing' }).success).toBe(false);
    });

    it('rejects negative appId', () => {
      expect(gameStatusSchema.safeParse({ ...valid, appId: -1 }).success).toBe(false);
    });

    it('rejects zero appId', () => {
      expect(gameStatusSchema.safeParse({ ...valid, appId: 0 }).success).toBe(false);
    });

    it('rejects float appId', () => {
      expect(gameStatusSchema.safeParse({ ...valid, appId: 123.45 }).success).toBe(false);
    });

    it('accepts valid positive integer appId', () => {
      expect(gameStatusSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe('status', () => {
    it('rejects missing status', () => {
      expect(gameStatusSchema.safeParse({ appId: 730 }).success).toBe(false);
    });

    it('rejects invalid status', () => {
      expect(gameStatusSchema.safeParse({ ...valid, status: 'completed' }).success).toBe(false);
    });

    it('accepts all valid statuses', () => {
      for (const status of ['backlog', 'playing', 'finished', 'dropped', 'hidden'] as const) {
        expect(gameStatusSchema.safeParse({ ...valid, status }).success).toBe(true);
      }
    });
  });

  describe('rating', () => {
    it('accepts null rating', () => {
      expect(gameStatusSchema.safeParse({ ...valid, rating: null }).success).toBe(true);
    });

    it('accepts rating of 0', () => {
      expect(gameStatusSchema.safeParse({ ...valid, rating: 0 }).success).toBe(true);
    });

    it('accepts rating of 10', () => {
      expect(gameStatusSchema.safeParse({ ...valid, rating: 10 }).success).toBe(true);
    });

    it('rejects rating above 10', () => {
      expect(gameStatusSchema.safeParse({ ...valid, rating: 11 }).success).toBe(false);
    });

    it('rejects rating below 0', () => {
      expect(gameStatusSchema.safeParse({ ...valid, rating: -1 }).success).toBe(false);
    });

    it('rejects float rating', () => {
      expect(gameStatusSchema.safeParse({ ...valid, rating: 7.5 }).success).toBe(false);
    });
  });

  describe('notes', () => {
    it('accepts notes within 1000 characters', () => {
      expect(gameStatusSchema.safeParse({ ...valid, notes: 'Great game' }).success).toBe(true);
    });

    it('accepts notes at exactly 1000 characters', () => {
      expect(gameStatusSchema.safeParse({ ...valid, notes: 'a'.repeat(1000) }).success).toBe(true);
    });

    it('rejects notes exceeding 1000 characters', () => {
      const result = gameStatusSchema.safeParse({ ...valid, notes: 'a'.repeat(1001) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Notes must be 1000 characters or fewer');
      }
    });

    it('accepts null notes', () => {
      expect(gameStatusSchema.safeParse({ ...valid, notes: null }).success).toBe(true);
    });
  });
});
