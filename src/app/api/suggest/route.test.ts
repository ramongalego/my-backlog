/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/suggest/route';
import { fetchAllRows } from '@/lib/supabase/paginate';

type Row = Record<string, unknown>;

let user: { id: string } | null = { id: 'user-1' };
let configured = true;
// Which limits refuse, by the start of their key.
let refused: string[] = [];
const limitsChecked: string[] = [];
const create = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/paginate', () => ({ fetchAllRows: jest.fn() }));
jest.mock('@/lib/server/env', () => ({
  getOpenAIApiKey: () => {
    if (!configured) throw new Error('missing');
    return 'test-key';
  },
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async (key: string) => {
    limitsChecked.push(key);
    return {
      success: !refused.some((r) => key.startsWith(r)),
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    };
  },
}));
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({ chat: { completions: { create } } })),
);

const backlogGame = (id: number, name: string, overrides: Row = {}): Row => ({
  id,
  app_id: id * 10,
  source: 'steam',
  platform: null,
  name,
  header_image: null,
  genres: ['RPG'],
  categories: ['Single-player'],
  tags: ['JRPG', 'Story Rich'],
  main_story_hours: 30,
  playtime_forever: 0,
  steam_review_score: 90,
  steam_review_count: 5000,
  critic_score: 85,
  critic_count: 20,
  steam_review_weighted: 88,
  reroll_count: 0,
  last_rerolled_at: null,
  last_played_at: null,
  release_date: 'Sep 28, 2010',
  ...overrides,
});

const BACKLOG = [
  backlogGame(1, 'Dragon Quest XI'),
  backlogGame(2, 'Octopath Traveler'),
  backlogGame(3, 'Tales of Arise'),
  backlogGame(4, 'Persona 3 Reload'),
];
const HISTORY = [
  {
    name: 'Persona 5 Royal',
    status: 'finished',
    rating: 9,
    tags: ['JRPG'],
    finished_at: '2026-01-01',
    dropped_at: null,
  },
  {
    name: 'Starfield',
    status: 'dropped',
    rating: null,
    tags: ['Open World'],
    finished_at: null,
    dropped_at: '2026-02-01',
  },
];

/** The three reads, in the order the route makes them: queue, backlog, history. */
function library({
  queued = [] as number[],
  backlog = BACKLOG as Row[],
  history = HISTORY as Row[],
} = {}) {
  jest
    .mocked(fetchAllRows)
    .mockReset()
    .mockResolvedValueOnce(queued.map((game_id) => ({ game_id })))
    .mockResolvedValueOnce(backlog)
    .mockResolvedValueOnce(history);
}

// The ids the model was allowed to answer with, and the messages it was sent.
const offeredIds = (call = 0): number[] =>
  create.mock.calls[call][0].response_format.json_schema.schema.properties.game_id.enum;
const answerWithFirstOffered =
  (reasoning = 'You gave Persona 5 Royal a 9, and this has the same long, talky evenings.') =>
  async (args: {
    response_format: { json_schema: { schema: { properties: { game_id: { enum: number[] } } } } };
  }) => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            game_id: args.response_format.json_schema.schema.properties.game_id.enum[0],
            reasoning,
          }),
        },
      },
    ],
  });

const suggest = (body: unknown = { mood: 'relaxed', energy: 'low', time: 'long' }) =>
  POST(
    new Request('http://localhost/api/suggest', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );

beforeEach(() => {
  user = { id: 'user-1' };
  configured = true;
  refused = [];
  limitsChecked.length = 0;
  create.mockReset().mockImplementation(answerWithFirstOffered());
  library();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('before the model is asked', () => {
  it('is unavailable without an OpenAI key', async () => {
    configured = false;
    expect((await suggest()).status).toBe(503);
  });

  it('refuses a signed-out request', async () => {
    user = null;
    expect((await suggest()).status).toBe(401);
  });

  it.each([
    ['a body that is not JSON', '{'],
    ['a mood that does not exist', { mood: 'sleepy', energy: 'low', time: 'long' }],
    ['a missing answer', { mood: 'relaxed', energy: 'low' }],
  ])('refuses %s', async (_, body) => {
    expect((await suggest(body)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('stops a player past the per-minute limit', async () => {
    refused = ['suggestion:user-1'];
    expect((await suggest()).status).toBe(429);
    expect(create).not.toHaveBeenCalled();
  });

  it("stops a player who has used the day's picks, and says so", async () => {
    refused = ['suggestion-daily:'];
    const res = await suggest();
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/used today's picks/);
    expect(create).not.toHaveBeenCalled();
  });

  it('says so when there is nothing in the backlog', async () => {
    library({ backlog: [] });
    const res = await suggest();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No games in backlog' });
  });

  it("doesn't spend anything once the day's budget for everyone is used", async () => {
    refused = ['suggestion:global'];
    const res = await suggest();
    expect(res.status).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });

  it("only counts against everyone's budget when the model will really be asked", async () => {
    library({ backlog: [] });
    await suggest();
    expect(limitsChecked).not.toContain('suggestion:global');
  });
});

describe('the pick', () => {
  it('comes from the backlog, with the reasoning', async () => {
    const res = await suggest();
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(BACKLOG.map((g) => g.id)).toContain(data.game.id);
    expect(data.reasoning).toMatch(/Persona 5 Royal a 9/);
  });

  it('can only be a game on the shortlist, never one that is queued or was just rolled', async () => {
    library({ queued: [1] });
    await suggest({ mood: 'relaxed', energy: 'low', time: 'long', excludeGameIds: [2] });

    expect(offeredIds().sort()).toEqual([3, 4]);
  });

  it("isn't a game that isn't out yet", async () => {
    library({
      backlog: [...BACKLOG, backlogGame(5, 'Persona 4 Revival', { release_date: 'Feb 18, 2099' })],
    });
    await suggest();
    expect(offeredIds()).not.toContain(5);
  });

  it('keeps the rules apart from the library, and sends the history as data', async () => {
    await suggest({
      mood: 'relaxed',
      energy: 'low',
      time: 'long',
      previousReasonings: ['An earlier explanation.'],
    });

    const [rules, brief] = create.mock.calls[0][0].messages;
    expect(rules.role).toBe('system');
    expect(rules.content).not.toContain('Dragon Quest XI');
    expect(brief.content).toContain('Dragon Quest XI');
    expect(brief.content).toContain('Persona 5 Royal (9/10)');
    expect(brief.content).toContain('An earlier explanation.');
  });

  it('has any link taken out of the reasoning before it is shown', async () => {
    create.mockImplementation(
      answerWithFirstOffered('Start tonight. More at https://evil.test/x today.'),
    );
    const { data } = await (await suggest()).json();
    expect(data.reasoning).toBe('Start tonight. More at today.');
  });
});

describe('when the model lets it down', () => {
  it('asks once more after an answer it cannot use', async () => {
    create
      .mockResolvedValueOnce({ choices: [{ message: { content: 'not json' } }] })
      .mockImplementationOnce(answerWithFirstOffered());

    expect((await suggest()).status).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('gives up after two unusable answers', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] });
    expect((await suggest()).status).toBe(502);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('says the service is unavailable when the calls themselves fail', async () => {
    create.mockRejectedValue(new Error('timeout'));
    expect((await suggest()).status).toBe(503);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
