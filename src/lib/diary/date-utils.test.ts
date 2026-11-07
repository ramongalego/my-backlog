import { getMonthKey, formatDay } from '@/lib/diary/date-utils';

describe('getMonthKey', () => {
  it('returns YYYY-MM from a plain date string', () => {
    expect(getMonthKey('2026-02-22')).toBe('2026-02');
  });

  it('returns YYYY-MM from a full ISO timestamp', () => {
    expect(getMonthKey('2026-02-22T14:30:00.000Z')).toBe('2026-02');
  });

  it('returns YYYY-MM from a timestamp with offset', () => {
    expect(getMonthKey('2025-12-01T00:00:00+00:00')).toBe('2025-12');
  });

  it('groups two dates in the same month to the same key', () => {
    expect(getMonthKey('2024-06-01')).toBe(getMonthKey('2024-06-30'));
  });

  it('distinguishes different months', () => {
    expect(getMonthKey('2024-06-15')).not.toBe(getMonthKey('2024-07-15'));
  });
});

describe('formatDay', () => {
  it('returns zero-padded day from plain date string', () => {
    expect(formatDay('2026-02-05')).toBe('05');
  });

  it('returns two-digit day for day >= 10', () => {
    expect(formatDay('2026-02-22')).toBe('22');
  });

  it('returns day from a full ISO timestamp', () => {
    expect(formatDay('2026-02-22T14:30:00.000Z')).toBe('22');
  });

  it('returns last day of month correctly', () => {
    expect(formatDay('2024-12-31')).toBe('31');
  });

  it('returns first day of month correctly', () => {
    expect(formatDay('2024-06-01')).toBe('01');
  });
});
