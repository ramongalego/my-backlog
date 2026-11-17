import type { SupabaseClient } from '@supabase/supabase-js';
import { syncOwnedGames } from '@/lib/server/steam-library';
import type { SteamGame } from '@/lib/steam/api';

// Art for new games isn't what these tests are about: none is found.
jest.mock('@/lib/steam/store-api', () => ({
  getStoreHeaderImages: async () => new Map(),
  findLegacyHeaderImages: async () => new Map(),
}));

interface StoredGame {
  app_id: number;
  playtime_forever: number | null;
  last_played_at: string | null;
  platform: string | null;
}

/**
 * Enough of the Supabase client for a sync: the Steam games already stored,
 * and what the sync then writes (`updates` by app id).
 */
function fakeSupabase(stored: StoredGame[]) {
  const inserted: Record<string, unknown>[] = [];
  const updates: Record<number, Record<string, unknown>> = {};
  const result = (data: unknown) => ({
    then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
  });
  const client = {
    from: (table: string) => {
      if (table === 'game_metadata') {
        const cache = { select: () => cache, in: () => cache, not: () => result([]) };
        return cache;
      }
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: () => result(stored),
        insert: (rows: Record<string, unknown>[]) => {
          inserted.push(...rows);
          return result(null);
        },
        update: (values: Record<string, unknown>) => {
          const write = {
            eq: (column: string, value: number) => {
              if (column === 'app_id') updates[value] = values;
              return write;
            },
            or: () => result(null),
          };
          return write;
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, inserted, updates };
}

const PORTAL_2 = 620;
const HADES = 1145360;
const NEW_GAME = 2161700;

const LAST_PLAYED = 1793491200;
const LAST_PLAYED_ISO = new Date(LAST_PLAYED * 1000).toISOString();

const onSteam = (app_id: number, playtime_forever: number | null): StoredGame => ({
  app_id,
  playtime_forever,
  last_played_at: null,
  platform: 'PC',
});

const steamGame = (appid: number, playtime_forever: number, rtime_last_played?: number) =>
  ({
    appid,
    name: `Game ${appid}`,
    playtime_forever,
    img_icon_url: '',
    rtime_last_played,
  }) as SteamGame;

// With "Always keep my total playtime private" on, Steam still lists every
// game, with 0 minutes on each.
describe('when Steam lists the games but shares no playtime', () => {
  const library = () => fakeSupabase([onSteam(PORTAL_2, 480), onSteam(HADES, 1200)]);

  it('leaves the hours that are stored alone', async () => {
    const { client, updates } = library();

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 0),
      steamGame(HADES, 0),
    ]);

    // Not one game is written, and none is counted as updated.
    expect(updates).toEqual({});
    expect(result).toEqual({ newGames: 0, updatedPlaytime: 0, updatedGames: 0 });
  });

  it('still saves a last-played date Steam does share, without the hours', async () => {
    const { client, updates } = library();

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 0, LAST_PLAYED),
      steamGame(HADES, 0),
    ]);

    expect(updates).toEqual({ [PORTAL_2]: { last_played_at: LAST_PLAYED_ISO } });
    expect(result).toEqual({ newGames: 0, updatedPlaytime: 0, updatedGames: 1 });
  });

  it('still adds a game bought since', async () => {
    const { client, inserted, updates } = library();

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 0),
      steamGame(HADES, 0),
      steamGame(NEW_GAME, 0),
    ]);

    expect(inserted.map((game) => game.app_id)).toEqual([NEW_GAME]);
    expect(updates).toEqual({});
    expect(result).toEqual({ newGames: 1, updatedPlaytime: 0, updatedGames: 0 });
  });
});

describe('when Steam shares playtime', () => {
  it('updates the hours that changed', async () => {
    const { client, updates } = fakeSupabase([onSteam(PORTAL_2, 480), onSteam(HADES, 1200)]);

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 540, LAST_PLAYED),
      steamGame(HADES, 1200),
    ]);

    expect(updates).toEqual({
      [PORTAL_2]: { playtime_forever: 540, last_played_at: LAST_PLAYED_ISO },
    });
    expect(result).toEqual({ newGames: 0, updatedPlaytime: 1, updatedGames: 1 });
  });

  it('takes 0 for one game at its word when other games have hours', async () => {
    // Hades was played on a console and moved back to Steam, so it still holds
    // the console's hours: the PC copy was never played, and Steam says so.
    const { client, updates } = fakeSupabase([onSteam(PORTAL_2, 480), onSteam(HADES, 1200)]);

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 540),
      steamGame(HADES, 0),
    ]);

    expect(updates).toEqual({
      [PORTAL_2]: { playtime_forever: 540 },
      [HADES]: { playtime_forever: 0 },
    });
    expect(result).toEqual({ newGames: 0, updatedPlaytime: 2, updatedGames: 2 });
  });
});

describe('a library with no hours stored', () => {
  it('imports a new library whose games all have 0 minutes', async () => {
    const { client, inserted } = fakeSupabase([]);

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 0),
      steamGame(HADES, 0),
    ]);

    expect(inserted.map((game) => [game.app_id, game.playtime_forever])).toEqual([
      [PORTAL_2, 0],
      [HADES, 0],
    ]);
    expect(result).toEqual({ newGames: 2, updatedPlaytime: 0, updatedGames: 0 });
  });

  it('syncs as usual when nothing was ever played, here or on Steam', async () => {
    const { client, updates } = fakeSupabase([onSteam(PORTAL_2, 0), onSteam(HADES, 0)]);

    const result = await syncOwnedGames(client, 'user', [
      steamGame(PORTAL_2, 0, LAST_PLAYED),
      steamGame(HADES, 0),
    ]);

    expect(updates).toEqual({
      [PORTAL_2]: { playtime_forever: 0, last_played_at: LAST_PLAYED_ISO },
    });
    expect(result).toEqual({ newGames: 0, updatedPlaytime: 0, updatedGames: 1 });
  });

  it("doesn't count hours entered for a game moved to a console: those were never Steam's", async () => {
    const { client, updates } = fakeSupabase([
      { ...onSteam(PORTAL_2, 300), platform: 'Switch' },
      // No playtime saved yet, so the sync has a 0 to write.
      onSteam(HADES, null),
    ]);

    await syncOwnedGames(client, 'user', [steamGame(PORTAL_2, 0), steamGame(HADES, 0)]);

    expect(updates).toEqual({ [HADES]: { playtime_forever: 0 } });
  });
});
