import { BulkMoveError, restoreGameStatuses, updateGameStatuses } from '@/lib/client/game-status';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const answer = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new SyntaxError('not JSON');
    return body;
  },
});

const was = {
  id: 1,
  status: 'backlog' as const,
  started_at: null,
  finished_at: null,
  dropped_at: null,
  notes: null,
  rating: null,
  last_played_at: null,
};

beforeEach(() => mockFetch.mockReset());

it('moves games in one request and resolves with what they had', async () => {
  mockFetch.mockResolvedValue(answer(200, { success: true, count: 1, previous: [was] }));

  expect(await updateGameStatuses([{ gameId: 1, status: 'hidden' }])).toEqual([was]);
  expect(mockFetch).toHaveBeenCalledWith('/api/games/status/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: [{ gameId: 1, status: 'hidden' }] }),
  });
});

it('sends an Undo as the games to write back', async () => {
  mockFetch.mockResolvedValue(answer(200, { success: true, count: 1 }));

  await restoreGameStatuses([was]);

  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ restore: [was] });
});

it("throws with the server's status and reason when it refuses", async () => {
  mockFetch.mockResolvedValue(answer(429, { error: 'Too many requests' }));

  const err = await updateGameStatuses([{ gameId: 1, status: 'hidden' }]).catch((e) => e);

  expect(err).toBeInstanceOf(BulkMoveError);
  expect(err).toMatchObject({ status: 429, message: 'Too many requests' });
});

it.each([
  ['a page that is not JSON', undefined],
  ["JSON that is not the route's answer", { hello: 'world' }],
])('does not take a 200 with %s for saved', async (_, body) => {
  mockFetch.mockResolvedValue(answer(200, body));

  await expect(updateGameStatuses([{ gameId: 1, status: 'hidden' }])).rejects.toBeInstanceOf(
    BulkMoveError,
  );
});
