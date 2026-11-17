import { bulkRestoreSchema, gameStatusSchema, gameSearchSchema } from '@/lib/validations/games';

describe('gameStatusSchema', () => {
  const valid = { gameId: 730, status: 'playing' as const };

  describe('gameId', () => {
    it('rejects missing gameId', () => {
      expect(gameStatusSchema.safeParse({ status: 'playing' }).success).toBe(false);
    });

    it('rejects negative gameId', () => {
      expect(gameStatusSchema.safeParse({ ...valid, gameId: -1 }).success).toBe(false);
    });

    it('rejects zero gameId', () => {
      expect(gameStatusSchema.safeParse({ ...valid, gameId: 0 }).success).toBe(false);
    });

    it('rejects float gameId', () => {
      expect(gameStatusSchema.safeParse({ ...valid, gameId: 123.45 }).success).toBe(false);
    });

    it('accepts valid positive integer gameId', () => {
      expect(gameStatusSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe('status', () => {
    it('rejects missing status', () => {
      expect(gameStatusSchema.safeParse({ gameId: 730 }).success).toBe(false);
    });

    it('rejects invalid status', () => {
      expect(gameStatusSchema.safeParse({ ...valid, status: 'completed' }).success).toBe(false);
    });

    it('accepts all valid statuses', () => {
      for (const status of [
        'backlog',
        'playing',
        'finished',
        'dropped',
        'wont_play',
        'hidden',
      ] as const) {
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

describe('gameStatusSchema dates', () => {
  const base = { gameId: 730, status: 'finished' as const };

  it.each([
    '2025-08-20',
    '2025-08-20T00:00:00+00:00',
    '2025-08-20T13:45:10.123Z',
    '2025-08-20T00:00:00',
  ])('accepts %s', (finishedAt) => {
    expect(gameStatusSchema.safeParse({ ...base, finishedAt }).success).toBe(true);
  });

  it.each(['2024-13-99xyz', '2024-02-30', 'nope'])('rejects %s', (finishedAt) => {
    expect(gameStatusSchema.safeParse({ ...base, finishedAt }).success).toBe(false);
  });
});

describe('gameStatusSchema for an Undo', () => {
  const undo = { gameId: 730, status: 'playing' as const, undo: true };

  describe('undoAgoMs (how long ago the change it undoes was made)', () => {
    it('is optional: an Undo from a page loaded before Undos were timed has none', () => {
      const result = gameStatusSchema.safeParse(undo);
      expect(result.success).toBe(true);
      expect(result.data?.undoAgoMs).toBeUndefined();
    });

    it.each([0, 1, 90_000, 7 * 24 * 60 * 60 * 1000])('accepts %d', (undoAgoMs) => {
      const result = gameStatusSchema.safeParse({ ...undo, undoAgoMs });
      expect(result.success).toBe(true);
      expect(result.data?.undoAgoMs).toBe(undoAgoMs);
    });

    it.each([
      ['a negative time', -1],
      ['a number sent as text', '90000'],
      ['text', 'a while ago'],
      ['null', null],
      ['true', true],
    ])('rejects %s', (_, undoAgoMs) => {
      expect(gameStatusSchema.safeParse({ ...undo, undoAgoMs }).success).toBe(false);
    });
  });

  describe('startedAt (when the game had been started, to put back)', () => {
    it.each(['2025-08-20', '2026-11-13T13:57:21.123+00:00'])('accepts %s', (startedAt) => {
      const result = gameStatusSchema.safeParse({ ...undo, startedAt });
      expect(result.success).toBe(true);
      expect(result.data?.startedAt).toBe(startedAt);
    });

    it('accepts null: the game had never been started', () => {
      const result = gameStatusSchema.safeParse({ ...undo, status: 'finished', startedAt: null });
      expect(result.success).toBe(true);
      expect(result.data?.startedAt).toBeNull();
    });

    it('is left out when it is not sent, which is not the same as null', () => {
      const result = gameStatusSchema.safeParse(undo);
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('startedAt');
    });

    it.each(['soon', '2024-02-30', ''])('rejects "%s"', (startedAt) => {
      expect(gameStatusSchema.safeParse({ ...undo, startedAt }).success).toBe(false);
    });
  });
});

describe("bulkRestoreSchema (a bulk move's Undo)", () => {
  const was = {
    id: 1,
    status: 'backlog' as const,
    started_at: null,
    finished_at: null,
    dropped_at: null,
    notes: null,
    rating: null,
    last_played_at: null,
  };

  it('takes the games to write back without a time: an Undo from a page loaded before Undos were timed', () => {
    const result = bulkRestoreSchema.safeParse({ restore: [was] });
    expect(result.success).toBe(true);
    expect(result.data?.agoMs).toBeUndefined();
  });

  it.each([0, 1, 90_000, 7 * 24 * 60 * 60 * 1000])(
    'accepts %d for how long ago the move was',
    (agoMs) => {
      const result = bulkRestoreSchema.safeParse({ restore: [was], agoMs });
      expect(result.success).toBe(true);
      expect(result.data?.agoMs).toBe(agoMs);
    },
  );

  it.each([
    ['a negative time', -1],
    ['a number sent as text', '90000'],
    ['text', 'a while ago'],
    ['null', null],
  ])('rejects %s for how long ago the move was', (_, agoMs) => {
    expect(bulkRestoreSchema.safeParse({ restore: [was], agoMs }).success).toBe(false);
  });
});

describe('gameSearchSchema (Add game search)', () => {
  const message = (q: string) => gameSearchSchema.safeParse(q).error?.issues[0]?.message;

  it('says which end a search is wrong at', () => {
    expect(message('z')).toBe('Search for at least 2 characters');
    expect(message('a'.repeat(101))).toBe('Search for 100 characters at most');
    expect(gameSearchSchema.safeParse('  zelda  ').data).toBe('zelda');
  });
});
