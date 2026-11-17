import { addToQueue, removeFromQueue, reorderQueue } from '@/lib/client/queue';

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
      body: JSON.stringify({ gameId: 42 }),
    });
  });

  it('should send how long ago the game was taken off when it is an Undo, and only then', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const sent = () => JSON.parse(mockFetch.mock.calls.at(-1)![1].body);

    await addToQueue(42, 90_000);
    expect(sent()).toEqual({ gameId: 42, undoAgoMs: 90_000 });

    // Pressed the moment the toast appeared: no time at all is still an Undo.
    await addToQueue(42, 0);
    expect(sent()).toEqual({ gameId: 42, undoAgoMs: 0 });

    await addToQueue(42);
    expect(sent()).toEqual({ gameId: 42 });
    expect(sent()).not.toHaveProperty('undoAgoMs');
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

    expect(mockFetch).toHaveBeenCalledWith('/api/queue?gameId=7', { method: 'DELETE' });
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
