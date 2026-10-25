import { fetchQueuedAppIds, addToQueue } from '@/lib/games/queue';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchQueuedAppIds', () => {
  it('should return a Set of app IDs from the queue', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ queue: [{ app_id: 1 }, { app_id: 2 }, { app_id: 3 }] }),
    });

    const result = await fetchQueuedAppIds();

    expect(result).toEqual(new Set([1, 2, 3]));
  });

  it('should return an empty Set when queue is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ queue: [] }),
    });

    const result = await fetchQueuedAppIds();

    expect(result).toEqual(new Set());
  });

  it('should return an empty Set when queue is missing from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await fetchQueuedAppIds();

    expect(result).toEqual(new Set());
  });

  // Errors propagate so React Query treats them as failures instead of caching
  // an empty queue.
  it('should throw when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchQueuedAppIds()).rejects.toThrow('Failed to load queue (500)');
  });

  it('should throw when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(fetchQueuedAppIds()).rejects.toThrow('Network error');
  });
});

describe('addToQueue', () => {
  it('should return true when the request succeeds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await addToQueue(42);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 42 }),
    });
  });

  it('should return false when the request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await addToQueue(42);

    expect(result).toBe(false);
  });

  it('should return false when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await addToQueue(42);

    expect(result).toBe(false);
  });
});
