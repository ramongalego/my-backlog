/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { steamHoursOf } from '@/lib/server/steam-hours';
import { getOwnedGames } from '@/lib/steam/api';

jest.mock('@/lib/steam/api', () => ({ getOwnedGames: jest.fn() }));
jest.mock('@/lib/server/env', () => ({ getSteamApiKey: () => 'key' }));

type Row = Record<string, unknown> | null;
// What each table answers with, and the filters each read was given.
let rows: { games: Row; profiles: Row };
let failing: 'games' | 'profiles' | null;
let filters: Record<string, [string, unknown][]>;

const supabase = {
  from: (table: 'games' | 'profiles') => {
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        (filters[table] ??= []).push([column, value]);
        return builder;
      },
      maybeSingle: async () =>
        failing === table
          ? { data: null, error: { message: 'down' } }
          : { data: rows[table], error: null },
    };
    return builder;
  },
} as unknown as SupabaseClient;

const steamGame = (appid: number, playtime_forever: number, rtime_last_played?: number) => ({
  appid,
  name: `Game ${appid}`,
  playtime_forever,
  img_icon_url: '',
  rtime_last_played,
});
const library = (games: ReturnType<typeof steamGame>[], isPrivate = false) =>
  jest.mocked(getOwnedGames).mockResolvedValue({ games, isPrivate });

beforeEach(() => {
  rows = { games: { app_id: 620 }, profiles: { steam_id: '7656' } };
  failing = null;
  filters = {};
  jest.mocked(getOwnedGames).mockReset();
  library([steamGame(620, 3050, 1_794_000_000), steamGame(400, 90)]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("gives Steam's total and last-played date for the player's own Steam game", async () => {
  expect(await steamHoursOf(supabase, 'user-1', 7)).toEqual({
    playtime_forever: 3050,
    last_played_at: new Date(1_794_000_000 * 1000).toISOString(),
  });
  expect(getOwnedGames).toHaveBeenCalledWith('7656', 'key');
  // Only the signed-in player's game, and only one that came from Steam.
  expect(filters.games).toEqual([
    ['user_id', 'user-1'],
    ['id', 7],
    ['source', 'steam'],
  ]);
  expect(filters.profiles).toEqual([['id', 'user-1']]);
});

it('gives no last-played date for a game never played on Steam', async () => {
  library([steamGame(620, 0, 0), steamGame(400, 90)]);
  expect(await steamHoursOf(supabase, 'user-1', 7)).toEqual({
    playtime_forever: 0,
    last_played_at: null,
  });
});

it.each([
  ["the game isn't the player's Steam game", () => (rows.games = null)],
  ['Steam is not linked', () => (rows.profiles = { steam_id: null })],
  ['the game cannot be read', () => (failing = 'games')],
  ['the profile cannot be read', () => (failing = 'profiles')],
  ['the Steam profile is private', () => library([], true)],
  ["Steam doesn't list the game", () => library([steamGame(400, 90)])],
  [
    'Steam is not sharing playtime: every game at 0',
    () => library([steamGame(620, 0), steamGame(400, 0)]),
  ],
  ['Steam does not answer', () => jest.mocked(getOwnedGames).mockRejectedValue(new Error('502'))],
])('gives nothing, and throws nothing, when %s', async (_, arrange) => {
  arrange();
  await expect(steamHoursOf(supabase, 'user-1', 7)).resolves.toBeNull();
});

it("doesn't ask Steam when there is nothing to ask about", async () => {
  rows.games = null;
  await steamHoursOf(supabase, 'user-1', 7);
  expect(getOwnedGames).not.toHaveBeenCalled();
});
