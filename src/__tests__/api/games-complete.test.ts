/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/complete/route';
import { applyStatusChange, promoteNextFromQueue } from '@/lib/games/apply-status';
import { fetchCompletionCounts } from '@/lib/games/completion';

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: `user-${Math.random()}` } } }) },
  }),
}));
jest.mock('@/lib/games/apply-status', () => ({
  applyStatusChange: jest.fn(),
  promoteNextFromQueue: jest.fn(),
}));
jest.mock('@/lib/games/completion', () => ({ fetchCompletionCounts: jest.fn() }));

const post = async (body: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/games/complete', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(applyStatusChange).mockResolvedValue({ ok: true });
  jest.mocked(fetchCompletionCounts).mockResolvedValue({ gamesFinished: 7, totalGames: 120 });
  jest.mocked(promoteNextFromQueue).mockResolvedValue(null);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('saves the finish, then returns the summary counts and the next game together', async () => {
  const next = {
    app_id: 2,
    name: 'Next',
    header_image: null,
    main_story_hours: 10,
    playtime_forever: 0,
  };
  jest.mocked(promoteNextFromQueue).mockResolvedValue(next);

  const { status, body } = await post({
    appId: 1,
    status: 'finished',
    finishedAt: '2026-10-25',
    rating: 9,
  });

  expect(status).toBe(200);
  expect(applyStatusChange).toHaveBeenCalledWith(
    expect.anything(),
    expect.any(String),
    expect.objectContaining({ appId: 1, status: 'finished', finishedAt: '2026-10-25', rating: 9 }),
  );
  expect(body).toEqual({
    counts: { gamesFinished: 7, totalGames: 120 },
    promoted: next,
    promoteFailed: false,
  });
});

it('still succeeds when the next game could not be started', async () => {
  jest.mocked(promoteNextFromQueue).mockRejectedValue(new Error('boom'));

  const { status, body } = await post({ appId: 1, status: 'dropped' });

  expect(status).toBe(200);
  expect(body).toMatchObject({ promoted: null, promoteFailed: true });
});

it('does not promote anything if the finish itself failed', async () => {
  jest
    .mocked(applyStatusChange)
    .mockResolvedValue({ ok: false, status: 404, error: 'Game not found' });

  const { status } = await post({ appId: 1, status: 'finished' });

  expect(status).toBe(404);
  expect(promoteNextFromQueue).not.toHaveBeenCalled();
});

it('only finishes or drops', async () => {
  expect((await post({ appId: 1, status: 'playing' })).status).toBe(400);
});
