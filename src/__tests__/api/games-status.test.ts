import {
  validateStatusUpdate,
  requiresClearingPlayingGames,
  VALID_STATUSES,
  GameStatus,
} from '@/lib/games/status-validation';

describe('validateStatusUpdate', () => {
  describe('appId validation', () => {
    it('should reject missing appId', () => {
      const result = validateStatusUpdate({ appId: undefined, status: 'playing' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject null appId', () => {
      const result = validateStatusUpdate({ appId: null, status: 'playing' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject non-number appId', () => {
      const result = validateStatusUpdate({ appId: 'abc', status: 'playing' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject negative appId', () => {
      const result = validateStatusUpdate({ appId: -1, status: 'playing' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject zero appId', () => {
      const result = validateStatusUpdate({ appId: 0, status: 'playing' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should reject float appId', () => {
      const result = validateStatusUpdate({ appId: 123.45, status: 'playing' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid appId');
    });

    it('should accept valid positive integer appId', () => {
      const result = validateStatusUpdate({ appId: 730, status: 'playing' });
      expect(result.valid).toBe(true);
      expect(result.data?.appId).toBe(730);
    });

    it('should accept large appId values', () => {
      const result = validateStatusUpdate({ appId: 1234567890, status: 'backlog' });
      expect(result.valid).toBe(true);
      expect(result.data?.appId).toBe(1234567890);
    });
  });

  describe('status validation', () => {
    it('should reject missing status', () => {
      const result = validateStatusUpdate({ appId: 123, status: undefined });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing status');
    });

    it('should reject null status', () => {
      const result = validateStatusUpdate({ appId: 123, status: null });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing status');
    });

    it('should reject empty string status', () => {
      const result = validateStatusUpdate({ appId: 123, status: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing status');
    });

    it('should reject invalid status values', () => {
      const invalidStatuses = ['invalid', 'completed', 'active', 'paused', 'PLAYING'];

      invalidStatuses.forEach((status) => {
        const result = validateStatusUpdate({ appId: 123, status });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid status');
      });
    });

    it('should accept all valid status values', () => {
      VALID_STATUSES.forEach((status) => {
        const result = validateStatusUpdate({ appId: 123, status });
        expect(result.valid).toBe(true);
        expect(result.data?.status).toBe(status);
      });
    });
  });

  describe('valid input', () => {
    it('should return valid result with parsed data for valid input', () => {
      const result = validateStatusUpdate({ appId: 730, status: 'playing' });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        appId: 730,
        status: 'playing',
      });
    });
  });
});

describe('requiresClearingPlayingGames', () => {
  it('should return true for "playing" status', () => {
    expect(requiresClearingPlayingGames('playing')).toBe(true);
  });

  it('should return false for all other statuses', () => {
    const otherStatuses: GameStatus[] = ['backlog', 'finished', 'dropped', 'hidden'];

    otherStatuses.forEach((status) => {
      expect(requiresClearingPlayingGames(status)).toBe(false);
    });
  });
});

describe('VALID_STATUSES constant', () => {
  it('should contain exactly 5 statuses', () => {
    expect(VALID_STATUSES).toHaveLength(5);
  });

  it('should include all expected statuses', () => {
    expect(VALID_STATUSES).toContain('backlog');
    expect(VALID_STATUSES).toContain('playing');
    expect(VALID_STATUSES).toContain('finished');
    expect(VALID_STATUSES).toContain('dropped');
    expect(VALID_STATUSES).toContain('hidden');
  });
});
