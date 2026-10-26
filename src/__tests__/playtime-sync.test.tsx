import { render } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatLastPlayed } from '@/lib/games/last-played';
import { syncOwnedGames } from '@/lib/steam/library';
import { PlaytimeRefresher } from '@/components/PlaytimeRefresher';

jest.mock('@/lib/steam/store-api', () => ({
  getStoreHeaderImages: async () => new Map(),
  findLegacyHeaderImages: async () => new Map(),
}));

const mockRefreshIfStale = jest.fn();
jest.mock('@/hooks/useLibraryRefresh', () => ({
  useLibraryRefresh: () => ({ refreshIfStale: mockRefreshIfStale }),
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u' }, profile: { steam_id: '1' }, authResolved: true }),
}));
let mockSyncing = false;
jest.mock('@/components/SyncProvider', () => ({
  useSyncContext: () => ({ isSyncing: mockSyncing }),
}));

describe('formatLastPlayed', () => {
  const now = Date.parse('2026-10-25T12:00:00Z');
  const ago = (hours: number) => new Date(now - hours * 3600_000).toISOString();

  it.each([
    [2, 'Last played today'],
    [30, 'Last played yesterday'],
    [24 * 3, 'Last played 3 days ago'],
    [24 * 8, 'Last played 1 week ago'],
    [24 * 21, 'Last played 3 weeks ago'],
    [24 * 65, 'Last played 2 months ago'],
    [24 * 365 * 5, 'Last played 5 years ago'],
  ])('%ih ago → %s', (hours, text) => {
    expect(formatLastPlayed(ago(hours), now)).toBe(text);
  });

  it('says nothing without a date', () => {
    expect(formatLastPlayed(null, now)).toBeNull();
  });
});

describe('syncOwnedGames and last played', () => {
  const rtime = (iso: string) => Date.parse(iso) / 1000;

  function fakeSupabase(
    rows: {
      app_id: number;
      playtime_forever: number;
      last_played_at: string | null;
      platform?: string | null;
    }[],
  ) {
    const updates: Record<string, unknown>[] = [];
    const inserts: Record<string, unknown>[] = [];
    const guards: string[] = [];
    const done = (data: unknown) => ({
      then: (resolve: (v: unknown) => unknown) => resolve({ data, error: null }),
    });
    const client = {
      from: (table: string) => {
        if (table === 'game_metadata') {
          const b = { select: () => b, in: () => ({ not: () => done([]) }) };
          return b;
        }
        let pending: Record<string, unknown> | null = null;
        const b: Record<string, unknown> = {
          select: () => b,
          order: () => b,
          range: () => done(rows),
          insert: (r: Record<string, unknown>[]) => {
            inserts.push(...r);
            return done(null);
          },
          update: (values: Record<string, unknown>) => {
            pending = values;
            return b;
          },
          eq: (column: string, value: unknown) => {
            if (pending && column === 'app_id') updates.push({ app_id: value, ...pending });
            return b;
          },
          // The update's guard against games moved to a console mid-sync.
          or: (filter: string) => {
            guards.push(filter);
            return done(null);
          },
        };
        return b;
      },
    };
    return { client: client as unknown as SupabaseClient, updates, inserts, guards };
  }

  const steamGame = (appid: number, playtime: number, lastPlayed?: string) => ({
    appid,
    name: `Game ${appid}`,
    playtime_forever: playtime,
    img_icon_url: '',
    ...(lastPlayed ? { rtime_last_played: rtime(lastPlayed) } : {}),
  });

  it('saves when you last played, and counts only real playtime changes', async () => {
    const { client, updates, inserts } = fakeSupabase([
      { app_id: 1, playtime_forever: 600, last_played_at: null },
      { app_id: 2, playtime_forever: 60, last_played_at: '2026-10-01T00:00:00.000Z' },
      { app_id: 3, playtime_forever: 30, last_played_at: '2026-01-01T00:00:00+00:00' },
    ]);

    const result = await syncOwnedGames(client, 'user', [
      // Same hours, but now we know when it was last played (first refresh after the change).
      steamGame(1, 600, '2021-06-29T13:02:00Z'),
      // Played more since.
      steamGame(2, 300, '2026-10-24T20:00:00Z'),
      // Nothing changed (same instant, different format).
      steamGame(3, 30, '2026-01-01T00:00:00Z'),
      // New game.
      steamGame(4, 0),
    ]);

    expect(updates).toEqual([
      { app_id: 1, playtime_forever: 600, last_played_at: '2021-06-29T13:02:00.000Z' },
      { app_id: 2, playtime_forever: 300, last_played_at: '2026-10-24T20:00:00.000Z' },
    ]);
    expect(inserts).toEqual([
      expect.objectContaining({ app_id: 4, last_played_at: null, platform: 'PC' }),
    ]);
    expect(result).toEqual({ newGames: 1, updatedPlaytime: 1, updatedGames: 2 });
  });

  it('leaves a game you moved to a console alone: its hours are the ones you entered', async () => {
    const { client, updates, guards } = fakeSupabase([
      { app_id: 1, playtime_forever: 180, last_played_at: null, platform: 'Switch' },
      { app_id: 2, playtime_forever: 60, last_played_at: null, platform: 'PC' },
    ]);
    await syncOwnedGames(client, 'user', [
      steamGame(1, 600, '2026-10-24T20:00:00Z'),
      steamGame(2, 120, '2026-10-24T20:00:00Z'),
    ]);
    expect(updates.map((u) => u.app_id)).toEqual([2]);
    // And the write itself skips a game moved after the sync read the library.
    expect(guards).toEqual(['platform.is.null,platform.eq.PC']);
  });

  it('keeps a known date when Steam stops sharing it', async () => {
    const { client, updates } = fakeSupabase([
      { app_id: 1, playtime_forever: 60, last_played_at: '2026-10-01T00:00:00Z' },
    ]);
    await syncOwnedGames(client, 'user', [steamGame(1, 120)]);
    expect(updates).toEqual([{ app_id: 1, playtime_forever: 120 }]);
  });
});

describe('PlaytimeRefresher', () => {
  beforeEach(() => {
    mockRefreshIfStale.mockClear();
    mockSyncing = false;
  });

  it('refreshes on open and when you come back to the tab', () => {
    render(<PlaytimeRefresher />);
    expect(mockRefreshIfStale).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('focus'));
    expect(mockRefreshIfStale).toHaveBeenCalledTimes(2);
  });

  it('waits while the library is still being set up', () => {
    mockSyncing = true;
    render(<PlaytimeRefresher />);
    window.dispatchEvent(new Event('focus'));
    expect(mockRefreshIfStale).not.toHaveBeenCalled();
  });
});
