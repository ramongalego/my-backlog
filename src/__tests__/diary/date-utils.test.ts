import { getMonthKey, formatMonthLabel, formatDay } from '@/lib/diary/date-utils';

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

describe('formatMonthLabel', () => {
  it('formats a plain date correctly', () => {
    expect(formatMonthLabel('2026-02-22')).toEqual({ month: 'FEB', year: '2026' });
  });

  it('formats a full ISO timestamp without producing NaN', () => {
    const result = formatMonthLabel('2026-02-22T14:30:00.000Z');
    expect(result.month).not.toBe('NaN');
    expect(result.year).not.toBe('NaN');
    expect(result).toEqual({ month: 'FEB', year: '2026' });
  });

  it('formats January correctly', () => {
    expect(formatMonthLabel('2025-01-05')).toEqual({ month: 'JAN', year: '2025' });
  });

  it('formats December correctly', () => {
    expect(formatMonthLabel('2024-12-31')).toEqual({ month: 'DEC', year: '2024' });
  });

  it('returns month in uppercase', () => {
    const { month } = formatMonthLabel('2024-06-15');
    expect(month).toBe(month.toUpperCase());
  });

  it('returns year as a 4-digit string', () => {
    const { year } = formatMonthLabel('2024-06-15');
    expect(year).toBe('2024');
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
