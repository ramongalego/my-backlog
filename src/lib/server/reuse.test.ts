/**
 * @jest-environment node
 */
import { reuse } from '@/lib/server/reuse';

beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-19T12:00:00Z') }));
afterEach(() => jest.useRealTimers());

const counted = () => {
  let reads = 0;
  const read = jest.fn(async (key: string) => `${key}#${++reads}`);
  return read;
};

it('hands back what it read for as long as it is told, then reads again', async () => {
  const read = counted();
  const get = reuse(read, { ms: 60_000, max: 10 });

  expect(await get('a')).toBe('a#1');
  jest.advanceTimersByTime(59_000);
  expect(await get('a')).toBe('a#1');
  expect(read).toHaveBeenCalledTimes(1);

  // Past its time it is read again before anything is answered: never the old one.
  jest.advanceTimersByTime(1_000);
  expect(await get('a')).toBe('a#2');
  // However long it then goes unasked.
  jest.advanceTimersByTime(3 * 24 * 60 * 60 * 1000);
  expect(await get('a')).toBe('a#3');
});

it('keeps each key its own', async () => {
  const get = reuse(counted(), { ms: 60_000, max: 10 });
  expect(await get('a')).toBe('a#1');
  expect(await get('b')).toBe('b#2');
  expect(await get('a')).toBe('a#1');
});

it('reads once for askers that arrive together', async () => {
  const read = counted();
  const get = reuse(read, { ms: 60_000, max: 10 });
  expect(await Promise.all([get('a'), get('a'), get('a')])).toEqual(['a#1', 'a#1', 'a#1']);
  expect(read).toHaveBeenCalledTimes(1);
});

it("doesn't keep a read that failed: the next asker reads again", async () => {
  const read = jest
    .fn<Promise<string>, [string]>()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValue('fine');
  const get = reuse(read, { ms: 60_000, max: 10 });

  await expect(get('a')).rejects.toThrow('timeout');
  expect(await get('a')).toBe('fine');
  expect(read).toHaveBeenCalledTimes(2);
});

it('lets the oldest go once it holds as many as it may', async () => {
  const read = counted();
  const get = reuse(read, { ms: 60_000, max: 2 });
  await get('a');
  await get('b');
  await get('c');
  // 'a' went to make room; 'b' and 'c' are still held.
  expect(await get('b')).toBe('b#2');
  expect(await get('c')).toBe('c#3');
  expect(await get('a')).toBe('a#4');
});
