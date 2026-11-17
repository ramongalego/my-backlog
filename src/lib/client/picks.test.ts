import { recordPickOutcome, recordRandomPick } from '@/lib/client/picks';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const answers = (status: number, body: unknown) =>
  mockFetch.mockResolvedValue({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  mockFetch.mockReset();
  answers(200, { success: true, pickId: 41 });
});

describe('recordRandomPick', () => {
  it('sends the pick to be kept and gives its id', async () => {
    await expect(recordRandomPick({ gameId: 7, mode: 'queue', attempt: 2 })).resolves.toBe(41);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/suggest/picks');
    expect(init.method).toBe('POST');
    // Home's Random may leave the page as its game starts.
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual({ gameId: 7, mode: 'queue', attempt: 2 });
  });

  it("sends what was done with it too, for Home's Random", async () => {
    await recordRandomPick({ gameId: 7, mode: 'play', attempt: 1, outcome: 'played' });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      gameId: 7,
      mode: 'play',
      attempt: 1,
      outcome: 'played',
    });
  });

  it.each([
    ['the server refuses it', () => answers(429, { error: 'Too many requests' })],
    ["the pick couldn't be kept", () => answers(200, { success: true, pickId: null })],
    ['the answer has no id', () => answers(200, {})],
    [
      'the answer is not JSON',
      () =>
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => Promise.reject(new Error('bad')),
        }),
    ],
    ['the request cannot be sent', () => mockFetch.mockRejectedValue(new TypeError('offline'))],
  ])('gives null, and throws nothing, when %s', async (_, arrange) => {
    arrange();
    await expect(recordRandomPick({ gameId: 7, mode: 'queue', attempt: 1 })).resolves.toBeNull();
  });
});

describe('recordPickOutcome', () => {
  it('sends what was done with the pick', () => {
    recordPickOutcome(41, 'queued');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/suggest/picks');
    expect(init.method).toBe('PATCH');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual({ pickId: 41, outcome: 'queued' });
  });

  it.each([null, undefined])("sends nothing for a pick that wasn't kept (%s)", (pickId) => {
    recordPickOutcome(pickId, 'played');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws nothing, now or later, when the request cannot be sent', async () => {
    mockFetch.mockRejectedValue(new TypeError('offline'));
    expect(() => recordPickOutcome(41, 'rerolled')).not.toThrow();
    // An unhandled rejection would fail the run here.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
