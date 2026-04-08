/**
 * @jest-environment node
 */
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/fetch-with-timeout';

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should return response on success', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await fetchWithTimeout('https://example.com', {}, 5000);

    expect(response.status).toBe(200);
  });

  it('should throw FetchTimeoutError on timeout', async () => {
    global.fetch = jest.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    await expect(fetchWithTimeout('https://slow.api', {}, 10)).rejects.toThrow(FetchTimeoutError);
  });

  it('should include URL and timeout in error message', async () => {
    global.fetch = jest.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    await expect(fetchWithTimeout('https://slow.api/data', {}, 50)).rejects.toThrow(
      /slow\.api\/data.*50ms/,
    );
  });

  it('should re-throw non-abort errors as-is', async () => {
    const networkError = new TypeError('Failed to fetch');
    global.fetch = jest.fn().mockRejectedValue(networkError);

    await expect(fetchWithTimeout('https://example.com', {}, 5000)).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('should pass options through to fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://example.com', { method: 'POST', body: 'data' }, 5000);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ method: 'POST', body: 'data' }),
    );
  });
});
