import { sinceNow } from '@/lib/undo';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-17T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

it('says how many milliseconds ago the change was made', () => {
  const since = sinceNow();
  expect(since()).toBe(0);

  jest.advanceTimersByTime(90_000);
  expect(since()).toBe(90_000);

  jest.advanceTimersByTime(1_500);
  expect(since()).toBe(91_500);
});

it('times each change from its own moment', () => {
  const first = sinceNow();
  jest.advanceTimersByTime(60_000);
  const second = sinceNow();
  jest.advanceTimersByTime(30_000);

  expect(first()).toBe(90_000);
  expect(second()).toBe(30_000);
});

it('is never negative, even when the clock was set back meanwhile', () => {
  const since = sinceNow();

  jest.setSystemTime(new Date('2026-11-17T11:00:00Z'));

  expect(since()).toBe(0);
});
