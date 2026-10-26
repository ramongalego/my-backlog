import { fetchAllRows } from '@/lib/supabase/paginate';

/** A fake table of `total` rows; records which ranges were asked for and how many ran at once. */
function table(total: number) {
  const requested: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const page = async (from: number, to: number) => {
    requested.push(from);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    const data = Array.from(
      { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
      (_, i) => from + i,
    );
    return { data, error: null };
  };
  return { page, requested, maxInFlight: () => maxInFlight };
}

it('makes a single request when everything fits in one page', async () => {
  const t = table(250);
  expect(await fetchAllRows(t.page)).toHaveLength(250);
  expect(t.requested).toEqual([0]);
});

it('fetches the rest of a large library in parallel, in order', async () => {
  const t = table(4500);
  const rows = await fetchAllRows(t.page);
  expect(rows).toEqual(Array.from({ length: 4500 }, (_, i) => i));
  expect(t.requested).toEqual([0, 1000, 2000, 3000, 4000]);
  expect(t.maxInFlight()).toBe(4);
});

it('keeps going when a whole batch is full', async () => {
  const t = table(5000);
  expect(await fetchAllRows(t.page)).toHaveLength(5000);
  // The second batch finds nothing after row 5,000 and stops.
  expect(t.requested.slice(0, 5)).toEqual([0, 1000, 2000, 3000, 4000]);
  expect(t.requested).toContain(5000);
});

it('throws when a page fails', async () => {
  const page = async (from: number) =>
    from === 2000
      ? { data: null, error: new Error('boom') }
      : { data: Array(1000).fill(0), error: null };
  await expect(fetchAllRows(page)).rejects.toThrow('boom');
});
