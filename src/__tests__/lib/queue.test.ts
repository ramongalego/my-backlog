import { addToQueue, removeFromQueue, reorderQueue } from '@/lib/games/queue';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('addToQueue', () => {
  it('should POST the app id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await addToQueue(42);

    expect(mockFetch).toHaveBeenCalledWith('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 42 }),
    });
  });

  it('should throw with the API error when the request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Game already in queue' }),
    });

    await expect(addToQueue(42)).rejects.toThrow(
      'Add to queue failed (409): Game already in queue',
    );
  });

  it('should throw when the error body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 504,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    await expect(addToQueue(42)).rejects.toThrow('Add to queue failed (504)');
  });
});

describe('removeFromQueue / reorderQueue', () => {
  it('should DELETE by app id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await removeFromQueue(7);

    expect(mockFetch).toHaveBeenCalledWith('/api/queue?appId=7', { method: 'DELETE' });
  });

  it('should PATCH the new order', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await reorderQueue([3, 1, 2]);

    expect(mockFetch).toHaveBeenCalledWith('/api/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: [3, 1, 2] }),
    });
  });
});
