import { secondsToHours } from '@/lib/hltb/time-utils';

describe('secondsToHours', () => {
  describe('basic conversions', () => {
    it('should convert 3600 seconds to 1 hour', () => {
      expect(secondsToHours(3600)).toBe(1);
    });

    it('should convert 7200 seconds to 2 hours', () => {
      expect(secondsToHours(7200)).toBe(2);
    });

    it('should convert 0 seconds to 0 hours', () => {
      expect(secondsToHours(0)).toBe(0);
    });
  });

  describe('decimal precision', () => {
    it('should round to 1 decimal place - 5400 seconds = 1.5 hours', () => {
      expect(secondsToHours(5400)).toBe(1.5);
    });

    it('should round to 1 decimal place - 1800 seconds = 0.5 hours', () => {
      expect(secondsToHours(1800)).toBe(0.5);
    });

    it('should round down when appropriate - 5401 seconds rounds to 1.5', () => {
      expect(secondsToHours(5401)).toBe(1.5);
    });

    it('should round up when appropriate - 5580 seconds rounds to 1.6', () => {
      expect(secondsToHours(5580)).toBe(1.6);
    });

    it('should handle values that round to .0', () => {
      expect(secondsToHours(3660)).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very small values', () => {
      expect(secondsToHours(360)).toBe(0.1);
    });

    it('should handle very large values', () => {
      expect(secondsToHours(360000)).toBe(100);
    });

    it('should handle typical game lengths', () => {
      expect(secondsToHours(18000)).toBe(5);
      expect(secondsToHours(43200)).toBe(12);
      expect(secondsToHours(144000)).toBe(40);
    });

    it('should handle fractional game lengths common in HLTB', () => {
      expect(secondsToHours(9000)).toBe(2.5);
      expect(secondsToHours(30600)).toBe(8.5);
    });
  });

  describe('rounding behavior verification', () => {
    it('should use standard rounding (round half up)', () => {
      expect(secondsToHours(3780)).toBe(1.1);
      expect(secondsToHours(3744)).toBe(1);
    });

    it('should always return a number', () => {
      const result = secondsToHours(12345);
      expect(typeof result).toBe('number');
      expect(Number.isNaN(result)).toBe(false);
    });
  });
});

describe('HLTB API integration behavior', () => {
  describe('typical HLTB response values', () => {
    it('should handle Portal (short game) - approximately 1.5 hours', () => {
      const portalSeconds = 5400;
      expect(secondsToHours(portalSeconds)).toBe(1.5);
    });

    it('should handle Celeste (medium game) - approximately 8 hours', () => {
      const celesteSeconds = 28800;
      expect(secondsToHours(celesteSeconds)).toBe(8);
    });

    it('should handle Elden Ring (long game) - approximately 55 hours', () => {
      const eldenRingSeconds = 198000;
      expect(secondsToHours(eldenRingSeconds)).toBe(55);
    });

    it('should handle very short games (< 1 hour)', () => {
      expect(secondsToHours(1800)).toBe(0.5);
    });
  });
});
