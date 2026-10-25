import type { SupabaseClient } from '@supabase/supabase-js';
import { syncOwnedGames } from '@/lib/steam/library';
import { findLegacyHeaderImages, getStoreHeaderImages } from '@/lib/steam/store-api';
import { classifyAppType } from '@/lib/games/software';

const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';

/** GetItems answers with assets for the apps in `known`, and nothing for the rest. */
function mockSteam(
  known: Record<number, { header: string; header_2x?: string }>,
  legacy: number[] = [],
) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'HEAD') {
      const id = Number(url.match(/apps\/(\d+)\/header\.jpg/)?.[1]);
      return { ok: legacy.includes(id) } as Response;
    }
    const params = JSON.parse(new URL(url).searchParams.get('input_json')!);
    const store_items = params.ids
      .map(({ appid }: { appid: number }) => appid)
      .filter((appid: number) => known[appid])
      .map((appid: number) => ({
        appid,
        assets: { asset_url_format: `steam/apps/${appid}/abc/\${FILENAME}`, ...known[appid] },
      }));
    return { ok: true, json: async () => ({ response: { store_items } }) } as Response;
  }) as typeof fetch;
}

describe('getStoreHeaderImages', () => {
  it('prefers the 920×430 header and skips apps the store no longer has', async () => {
    mockSteam({
      1: { header: 'header.jpg', header_2x: 'header_2x.jpg' },
      2: { header: 'header.jpg' },
    });

    const images = await getStoreHeaderImages([1, 2, 3]);

    expect(images.get(1)).toBe(`${ASSETS}steam/apps/1/abc/header_2x.jpg`);
    expect(images.get(2)).toBe(`${ASSETS}steam/apps/2/abc/header.jpg`);
    expect(images.has(3)).toBe(false);
  });

  it('asks for 50 apps per call', async () => {
    mockSteam({});
    await getStoreHeaderImages(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('findLegacyHeaderImages', () => {
  it('keeps only the old-path headers that exist', async () => {
    mockSteam({}, [205890]);
    const images = await findLegacyHeaderImages([205890, 208610]);
    expect([...images.keys()]).toEqual([205890]);
    expect(images.get(205890)).toBe(`${ASSETS}steam/apps/205890/header.jpg`);
  });
});

describe('syncOwnedGames', () => {
  /** Enough of the Supabase client for an import into an empty library. */
  function fakeSupabase(cachedHeaders: Record<number, string>) {
    const inserted: Record<string, unknown>[] = [];
    const result = (data: unknown) => ({
      then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
    });
    const client = {
      from: (table: string) => {
        if (table === 'game_metadata') {
          const builder = {
            select: () => builder,
            in: (_: string, ids: number[]) => {
              const rows = ids
                .filter((id) => cachedHeaders[id])
                .map((app_id) => ({ app_id, header_image: cachedHeaders[app_id] }));
              return { not: () => result(rows) };
            },
          };
          return builder;
        }
        const builder = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          range: () => result([]),
          insert: (rows: Record<string, unknown>[]) => {
            inserted.push(...rows);
            return result(null);
          },
        };
        return builder;
      },
    };
    return { client: client as unknown as SupabaseClient, inserted };
  }

  const steamGame = (appid: number) => ({
    appid,
    name: `Game ${appid}`,
    playtime_forever: 0,
    img_icon_url: '',
  });

  it('gives new games cover art straight away', async () => {
    mockSteam({ 2: { header: 'header.jpg', header_2x: 'header_2x.jpg' } }, [3]);
    const { client, inserted } = fakeSupabase({ 1: 'https://cached/header.jpg' });

    await syncOwnedGames(client, 'user', [1, 2, 3, 4].map(steamGame));

    expect(Object.fromEntries(inserted.map((g) => [g.app_id, g.header_image]))).toEqual({
      1: 'https://cached/header.jpg',
      2: `${ASSETS}steam/apps/2/abc/header_2x.jpg`,
      3: `${ASSETS}steam/apps/3/header.jpg`,
      4: null,
    });
  });

  it('still imports the library when the art lookups fail', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as typeof fetch;
    const { client, inserted } = fakeSupabase({});

    await syncOwnedGames(client, 'user', [steamGame(1)]);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].header_image).toBeNull();
  });
});

describe('classifyAppType', () => {
  it('files software Steam calls a game as software', () => {
    expect(
      classifyAppType('game', {
        genres: ['Casual', 'Indie', 'Animation & Modeling', 'Utilities'],
        tags: ['Utilities', 'Anime', 'Software'],
      }),
    ).toBe('software');
  });

  it('leaves games and other types alone', () => {
    expect(
      classifyAppType('game', { genres: ['Action', 'RPG'], tags: ['RPG', 'Open World'] }),
    ).toBe('game');
    expect(classifyAppType('dlc', { genres: ['Utilities'], tags: null })).toBe('dlc');
  });
});
