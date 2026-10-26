// PostgREST caps every response at `max_rows` (1000 by default), so any query
// over a user's whole library has to page or it silently truncates large
// libraries. The builder must apply a stable `.order()` for paging to be
// consistent.
const PAGE_SIZE = 1000;
// Pages requested at once after the first. Most libraries fit in the first
// page; a 5,000-game one takes two rounds instead of five in a row.
const PARALLEL_PAGES = 4;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult<T>,
): Promise<T[]> {
  const fetchPage = async (index: number) => {
    const from = index * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    return data ?? [];
  };

  const rows = await fetchPage(0);
  if (rows.length < PAGE_SIZE) return rows;

  // The total isn't known up front, so ask for the next few pages together
  // and stop at the first one that comes back short.
  for (let next = 1; ; next += PARALLEL_PAGES) {
    const pages = await Promise.all(
      Array.from({ length: PARALLEL_PAGES }, (_, i) => fetchPage(next + i)),
    );
    for (const data of pages) {
      rows.push(...data);
      if (data.length < PAGE_SIZE) return rows;
    }
  }
}

// Splits ids for `.in()` filters so the request URL stays well under limits.
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
