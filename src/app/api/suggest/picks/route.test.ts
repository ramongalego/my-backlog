/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PATCH, POST } from '@/app/api/suggest/picks/route';
import { recordPick, recordPickOutcome } from '@/lib/server/picks';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

let user: { id: string } | null;
let lastUser = 0;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/server/picks', () => ({
  recordPick: jest.fn(),
  recordPickOutcome: jest.fn(),
}));

const send = (handler: typeof POST, method: string) => (body: unknown) =>
  handler(
    new Request('http://localhost/api/suggest/picks', {
      method,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );
const keep = send(POST, 'POST');
const answer = send(PATCH, 'PATCH');

beforeEach(() => {
  // A new player each time, so one test's requests don't count toward another's limit.
  user = { id: `user-${++lastUser}` };
  jest.mocked(recordPick).mockReset().mockResolvedValue(41);
  jest.mocked(recordPickOutcome).mockReset().mockResolvedValue();
});

describe('keeping a random pick', () => {
  it("keeps it as the signed-in player's, and answers with its id", async () => {
    const res = await keep({ gameId: 7, mode: 'queue', attempt: 2 });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, pickId: 41 });
    expect(recordPick).toHaveBeenCalledWith({
      userId: user!.id,
      gameId: 7,
      mode: 'queue',
      attempt: 2,
    });
  });

  it("keeps Home's Random as played at once", async () => {
    await keep({ gameId: 7, mode: 'play', attempt: 1, outcome: 'played' });
    expect(recordPick).toHaveBeenCalledWith({
      userId: user!.id,
      gameId: 7,
      mode: 'play',
      attempt: 1,
      outcome: 'played',
    });
  });

  it('never keeps it as a pick from the questions, or as another player’s', async () => {
    await keep({
      gameId: 7,
      mode: 'play',
      attempt: 1,
      userId: 'someone-else',
      user_id: 'someone-else',
      kind: 'questions',
      questions: { answers: { mood: 'relaxed', energy: 'low', time: 'short' } },
      reasoning: 'Made up',
    });
    expect(recordPick).toHaveBeenCalledWith({
      userId: user!.id,
      gameId: 7,
      mode: 'play',
      attempt: 1,
    });
  });

  it("still answers 200 when the pick couldn't be kept", async () => {
    jest.mocked(recordPick).mockResolvedValue(null);
    const res = await keep({ gameId: 7, mode: 'queue', attempt: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, pickId: null });
  });

  it.each([
    ['a body that is not JSON', '{'],
    ['no game', { mode: 'queue', attempt: 1 }],
    ['a game id that is not one', { gameId: -3, mode: 'queue', attempt: 1 }],
    ['a mode that does not exist', { gameId: 7, mode: 'later', attempt: 1 }],
    ['no mode', { gameId: 7, attempt: 1 }],
    ['an attempt before the first', { gameId: 7, mode: 'queue', attempt: 0 }],
    ['an attempt that is not whole', { gameId: 7, mode: 'queue', attempt: 1.5 }],
    ['an absurd attempt', { gameId: 7, mode: 'queue', attempt: 10_001 }],
    [
      'an outcome a new pick cannot have',
      { gameId: 7, mode: 'queue', attempt: 1, outcome: 'rerolled' },
    ],
  ])('refuses %s', async (_, body) => {
    expect((await keep(body)).status).toBe(400);
    expect(recordPick).not.toHaveBeenCalled();
  });

  it('refuses a signed-out request', async () => {
    user = null;
    expect((await keep({ gameId: 7, mode: 'queue', attempt: 1 })).status).toBe(401);
    expect(recordPick).not.toHaveBeenCalled();
  });

  it('keeps picks up to the per-player limit, then refuses without keeping', async () => {
    for (let i = 0; i < RATE_LIMITS.pickRecord.limit; i++) {
      expect((await keep({ gameId: 7, mode: 'queue', attempt: 1 })).status).toBe(200);
    }
    const res = await keep({ gameId: 7, mode: 'queue', attempt: 1 });
    expect(res.status).toBe(429);
    expect(recordPick).toHaveBeenCalledTimes(RATE_LIMITS.pickRecord.limit);
  });
});

describe('keeping what was done with a pick', () => {
  it.each(['played', 'queued', 'rerolled', 'unseen'] as const)(
    "keeps '%s' on the signed-in player's pick",
    async (outcome) => {
      const res = await answer({ pickId: 41, outcome });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(recordPickOutcome).toHaveBeenCalledWith(user!.id, 41, outcome);
    },
  );

  it.each([
    ['a body that is not JSON', '{'],
    ['no pick', { outcome: 'played' }],
    ['a pick id that is not one', { pickId: 0, outcome: 'played' }],
    ['a pick id that is text', { pickId: '41', outcome: 'played' }],
    ['no outcome', { pickId: 41 }],
    ['an outcome that does not exist', { pickId: 41, outcome: 'ignored' }],
  ])('refuses %s', async (_, body) => {
    expect((await answer(body)).status).toBe(400);
    expect(recordPickOutcome).not.toHaveBeenCalled();
  });

  it('refuses a signed-out request', async () => {
    user = null;
    expect((await answer({ pickId: 41, outcome: 'played' })).status).toBe(401);
    expect(recordPickOutcome).not.toHaveBeenCalled();
  });

  it('has its own limit, apart from keeping picks', async () => {
    for (let i = 0; i < RATE_LIMITS.pickRecord.limit; i++) {
      await keep({ gameId: 7, mode: 'queue', attempt: 1 });
    }
    expect((await keep({ gameId: 7, mode: 'queue', attempt: 1 })).status).toBe(429);
    expect((await answer({ pickId: 41, outcome: 'queued' })).status).toBe(200);

    for (let i = 1; i < RATE_LIMITS.pickRecord.limit; i++) {
      await answer({ pickId: 41, outcome: 'queued' });
    }
    expect((await answer({ pickId: 41, outcome: 'queued' })).status).toBe(429);
  });
});
