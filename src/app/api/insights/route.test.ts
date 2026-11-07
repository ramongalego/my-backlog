/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import type { GameItem } from '@/lib/data/loaders';
import { POST } from '@/app/api/insights/route';
import { factsSignature, playerFacts } from '@/lib/profile/facts';

let user: { id: string } | null = { id: 'user-1' };
let games: GameItem[] = [];
let saved: Record<string, unknown> | null = null;
let limited = false;
const create = jest.fn();
const saveInsight = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/data/loaders', () => ({ loadGamesList: async () => games }));
jest.mock('@/lib/server/player-insights', () => ({
  getSavedInsight: async () => saved,
  saveInsight: (...args: unknown[]) => saveInsight(...args),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({ success: !limited }),
}));
jest.mock('@/lib/server/env', () => ({ getOpenAIApiKey: () => 'test-key' }));
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({ chat: { completions: { create } } })),
);

const game = (overrides: Partial<GameItem>): GameItem =>
  ({
    id: Math.random(),
    name: 'Game',
    status: 'backlog',
    playtime_forever: 0,
    main_story_hours: null,
    tags: null,
    rating: null,
    finished_at: null,
    header_image: null,
    release_date: null,
    ...overrides,
  }) as GameItem;

const enoughGames = () =>
  Array.from({ length: 10 }, (_, i) => game({ name: `Played ${i}`, playtime_forever: 600 }));

const ask = (body: unknown) =>
  POST(
    new Request('http://localhost/api/insights', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );

const written = { headline: 'A completionist at heart', paragraphs: ['One.', 'Two.'] };
const answer = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  user = { id: 'user-1' };
  games = enoughGames();
  saved = null;
  limited = false;
  create.mockReset().mockResolvedValue(answer(JSON.stringify(written)));
  saveInsight.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await ask({ tone: 'profile' })).status).toBe(401);
});

it.each([
  ['bad JSON', '{'],
  ['an unknown tone', { tone: 'poem' }],
])('refuses %s', async (_, body) => {
  expect((await ask(body)).status).toBe(400);
});

it('refuses a library that says too little, without calling the model', async () => {
  games = [game({}), game({})];
  const res = await ask({ tone: 'profile' });
  expect(res.status).toBe(422);
  expect(create).not.toHaveBeenCalled();
});

it('writes one, sends the facts as data, and saves it with their signature', async () => {
  const res = await ask({ tone: 'roast' });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject(written);

  const { messages } = create.mock.calls[0][0];
  expect(JSON.parse(messages[1].content)).toEqual(playerFacts(games));
  expect(saveInsight).toHaveBeenCalledWith(
    'user-1',
    'roast',
    written,
    factsSignature(playerFacts(games)!),
  );
});

it("returns the saved one when the library hasn't changed, without calling the model", async () => {
  saved = {
    headline: 'Saved',
    paragraphs: ['Earlier.'],
    signature: factsSignature(playerFacts(games)!),
    generatedAt: '2026-11-01T00:00:00.000Z',
  };
  const res = await ask({ tone: 'profile' });
  expect(await res.json()).toEqual({
    headline: 'Saved',
    paragraphs: ['Earlier.'],
    generatedAt: '2026-11-01T00:00:00.000Z',
  });
  expect(create).not.toHaveBeenCalled();
});

describe('past the day’s limit', () => {
  beforeEach(() => {
    limited = true;
  });

  it('returns the last one written, even if the library has changed', async () => {
    saved = { headline: 'Old', paragraphs: ['Old.'], signature: 'stale', generatedAt: 'x' };
    const res = await ask({ tone: 'profile' });
    expect(res.status).toBe(200);
    expect((await res.json()).headline).toBe('Old');
    expect(create).not.toHaveBeenCalled();
  });

  it('is a 429 when there is none', async () => {
    expect((await ask({ tone: 'profile' })).status).toBe(429);
    expect(create).not.toHaveBeenCalled();
  });
});

it('tries again once when the answer is unusable, then gives up with a 503', async () => {
  create.mockResolvedValue(answer('not json'));
  const res = await ask({ tone: 'profile' });
  expect(res.status).toBe(503);
  expect(create).toHaveBeenCalledTimes(2);
  expect(saveInsight).not.toHaveBeenCalled();
});

it('uses a second attempt when the first fails', async () => {
  create.mockRejectedValueOnce(new Error('timeout'));
  const res = await ask({ tone: 'profile' });
  expect(res.status).toBe(200);
  expect(create).toHaveBeenCalledTimes(2);
});
