import type { SupabaseClient } from '@supabase/supabase-js';
import { headerImageChanged, refreshStoreData } from '@/lib/server/steam-store-data';
import { getStoreSummaries, type StoreSummary } from '@/lib/steam/store-api';

jest.mock('@/lib/steam/store-api', () => ({ getStoreSummaries: jest.fn() }));

const ART = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg';
const LAUNCH_ART =
  'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/a1/header_2x.jpg';

const steamGame = {
  id: 1,
  source: 'steam',
  app_id: 10,
  steam_app_id: null,
  steam_review_score: 80,
  steam_review_count: 100,
  header_image: ART,
};
const handAdded = {
  id: 2,
  source: 'manual',
  app_id: null,
  steam_app_id: 20,
  steam_review_score: null,
  steam_review_count: null,
  header_image: null,
};

/** A Supabase stand-in that returns `rows` and records every update. */
function fakeClient(
  rows: object[],
  writes: { table: string; values: object; filters: string[] }[],
) {
  return {
    from: (table: string) => {
      const write = { table, values: {}, filters: [] as string[] };
      const builder = {
        select: () => builder,
        or: () => builder,
        order: () => builder,
        range: async () => ({ data: rows, error: null }),
        update: (values: object) => ((write.values = values), writes.push(write), builder),
        eq: (col: string, val: unknown) => (write.filters.push(`${col}=${val}`), builder),
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const store = (entries: [number, StoreSummary][]) =>
  jest.mocked(getStoreSummaries).mockResolvedValue(new Map(entries));

it('refreshes Steam games and games added by hand that Steam sells, each by its own row', async () => {
  store([
    [10, { reviews: { score: 85, count: 120 }, headerImage: ART }],
    [20, { reviews: { score: 92, count: 30000 }, headerImage: null }],
  ]);
  const writes: { table: string; values: object; filters: string[] }[] = [];

  expect(
    await refreshStoreData(fakeClient([steamGame, handAdded], writes), 'u', fakeClient([], writes)),
  ).toBe(2);
  expect(getStoreSummaries).toHaveBeenCalledWith([10, 20]);
  expect(writes.map(({ table, filters }) => ({ table, filters }))).toEqual([
    { table: 'games', filters: ['user_id=u', 'id=1'] },
    // Only Steam games are in the shared cache.
    { table: 'game_metadata', filters: ['app_id=10'] },
    { table: 'games', filters: ['user_id=u', 'id=2'] },
  ]);
  // The art hadn't changed, so only the reviews are written.
  expect(writes[0].values).not.toHaveProperty('header_image');
});

it("picks up art Steam has swapped, in the user's row and the shared cache", async () => {
  store([[10, { reviews: { score: 80, count: 100 }, headerImage: LAUNCH_ART }]]);
  const writes: { table: string; values: object; filters: string[] }[] = [];

  expect(await refreshStoreData(fakeClient([steamGame], writes), 'u', fakeClient([], writes))).toBe(
    1,
  );
  expect(writes.map((w) => [w.table, w.values])).toEqual([
    ['games', { header_image: LAUNCH_ART }],
    ['game_metadata', { header_image: LAUNCH_ART }],
  ]);
});

it('writes nothing when neither changed, and keeps art Steam no longer returns', async () => {
  store([
    [10, { reviews: { score: 80, count: 100 }, headerImage: ART }],
    [20, { reviews: null, headerImage: null }],
  ]);
  const writes: { table: string; values: object; filters: string[] }[] = [];

  expect(
    await refreshStoreData(
      fakeClient([steamGame, { ...handAdded, header_image: ART }], writes),
      'u',
      null,
    ),
  ).toBe(0);
  expect(writes).toEqual([]);
});

describe('headerImageChanged', () => {
  const base = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4530370';
  const hashed = (hash: string, t: number) =>
    `${base}/${hash.repeat(40 / hash.length)}/header_2x.jpg?t=${t}`;

  it('is true for a different picture', () => {
    expect(headerImageChanged(hashed('a', 1), hashed('b', 1))).toBe(true);
    expect(headerImageChanged(`${base}/header.jpg?t=1`, hashed('b', 2))).toBe(true);
    expect(headerImageChanged(null, hashed('b', 2))).toBe(true);
  });

  it("is false when only a hashed path's ?t= moved: the same file", () => {
    expect(headerImageChanged(hashed('a', 1), hashed('a', 2))).toBe(false);
  });

  it('counts ?t= for a fixed path, where Steam replaces the file in place', () => {
    expect(headerImageChanged(`${base}/header.jpg?t=1`, `${base}/header.jpg?t=2`)).toBe(true);
    expect(headerImageChanged(`${base}/header.jpg?t=1`, `${base}/header.jpg?t=1`)).toBe(false);
  });
});
