import { promoteNextFromQueue } from '@/lib/promoteNextFromQueue';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Minimal chainable supabase mock: each call returns `this`, the terminal
// .single() returns whatever queueData/gameData is configured.
function makeSupabase({
  queueData,
  gameData,
}: {
  queueData: { app_id: number } | null;
  gameData?: Record<string, unknown> | null;
}) {
  const callQueue: Array<{ app_id: number } | Record<string, unknown> | null> = [
    queueData,
    gameData ?? null,
  ];

  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(async () => {
      const next = callQueue.shift() ?? null;
      return { data: next, error: null };
    }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return chain as any;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('promoteNextFromQueue', () => {
  const userId = 'user-123';

  it('returns null when the queue is empty', async () => {
    const supabase = makeSupabase({ queueData: null });

    const result = await promoteNextFromQueue(userId, supabase);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('promotes the top item and returns the game on full success', async () => {
    const supabase = makeSupabase({
      queueData: { app_id: 42 },
      gameData: { app_id: 42, name: 'Hollow Knight' },
    });
    mockFetch.mockResolvedValueOnce({ ok: true }); // promote to playing
    mockFetch.mockResolvedValueOnce({ ok: true }); // remove from queue

    const result = await promoteNextFromQueue(userId, supabase);

    expect(result).toEqual({ app_id: 42, name: 'Hollow Knight' });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/games/status',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ appId: 42, status: 'playing' }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/queue?appId=42', { method: 'DELETE' });
  });

  it('throws when the status-update fetch fails', async () => {
    // Regression guard: silent !ok responses here previously let callers
    // proceed as if the promotion had succeeded, leaving the UI showing a
    // "now playing" game whose DB status was actually still 'backlog'.
    const supabase = makeSupabase({ queueData: { app_id: 42 } });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(promoteNextFromQueue(userId, supabase)).rejects.toThrow(/Failed to promote/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the remove-from-queue fetch fails', async () => {
    // Regression guard: a silent failure here used to leave the promoted
    // game in both "Now Playing" and "Up Next" because its playing_queue
    // row was never deleted.
    const supabase = makeSupabase({ queueData: { app_id: 42 } });
    mockFetch.mockResolvedValueOnce({ ok: true }); // promote ok
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 }); // delete fails

    await expect(promoteNextFromQueue(userId, supabase)).rejects.toThrow(
      /Failed to remove promoted game/,
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
