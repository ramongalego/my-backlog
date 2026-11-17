/**
 * @jest-environment node
 */
import { recordPick, recordPickOutcome } from '@/lib/server/picks';

// What the server's client was asked to do, in order.
let calls: unknown[][] = [];
// What the database answers with.
let answer: { data: unknown; error: { message: string } | null } = {
  data: { id: 41 },
  error: null,
};
let hasKey = true;
let throws = false;
// The time limits the writes were given.
let signals: AbortSignal[] = [];

jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => {
    if (!hasKey) return null;
    const query = {
      insert: (row: unknown) => (calls.push(['insert', row]), query),
      update: (row: unknown) => (calls.push(['update', row]), query),
      select: (columns: string) => (calls.push(['select', columns]), query),
      eq: (column: string, value: unknown) => (calls.push(['eq', column, value]), query),
      is: (column: string, value: unknown) => (calls.push(['is', column, value]), query),
      abortSignal: (signal: AbortSignal) => (signals.push(signal), query),
      single: async () => {
        if (throws) throw new Error('network down');
        return answer;
      },
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
        throws ? reject(new Error('network down')) : resolve(answer),
    };
    return {
      from: (table: string) => (calls.push(['from', table]), query),
    };
  },
}));

const NOW = '2026-11-17T21:00:00.000Z';

beforeEach(() => {
  calls = [];
  answer = { data: { id: 41 }, error: null };
  hasKey = true;
  throws = false;
  signals = [];
  jest.useFakeTimers().setSystemTime(new Date(NOW));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const inserted = () => calls.find(([what]) => what === 'insert')?.[1];

describe('recordPick', () => {
  it('keeps a pick from the questions with the answers, the reason and the model', async () => {
    const id = await recordPick({
      userId: 'user-1',
      gameId: 7,
      mode: 'queue',
      attempt: 3,
      questions: {
        answers: { mood: 'relaxed', energy: 'low', time: 'short' },
        reasoning: 'Short and gentle.',
        model: 'a-model',
      },
    });

    expect(id).toBe(41);
    expect(calls[0]).toEqual(['from', 'game_picks']);
    expect(inserted()).toEqual({
      user_id: 'user-1',
      game_id: 7,
      kind: 'questions',
      mode: 'queue',
      mood: 'relaxed',
      energy: 'low',
      time: 'short',
      attempt: 3,
      reasoning: 'Short and gentle.',
      model: 'a-model',
      outcome: null,
      created_at: NOW,
      answered_at: null,
    });
  });

  it('keeps a random pick with no answers, reason or model', async () => {
    await recordPick({ userId: 'user-1', gameId: 7, mode: 'queue', attempt: 2 });
    expect(inserted()).toEqual({
      user_id: 'user-1',
      game_id: 7,
      kind: 'random',
      mode: 'queue',
      mood: null,
      energy: null,
      time: null,
      attempt: 2,
      reasoning: null,
      model: null,
      outcome: null,
      created_at: NOW,
      answered_at: null,
    });
  });

  it('keeps a pick that was acted on at once as answered when it was made', async () => {
    await recordPick({ userId: 'user-1', gameId: 7, mode: 'play', attempt: 1, outcome: 'played' });
    expect(inserted()).toMatchObject({ outcome: 'played', created_at: NOW, answered_at: NOW });
  });

  it('cuts a reason that runs on', async () => {
    await recordPick({
      userId: 'user-1',
      gameId: 7,
      mode: 'play',
      attempt: 1,
      questions: {
        answers: { mood: 'relaxed', energy: 'low', time: 'short' },
        reasoning: 'x'.repeat(5000),
        model: 'a-model',
      },
    });
    expect((inserted() as { reasoning: string }).reasoning).toHaveLength(2000);
  });

  it('gives the write a time limit, so a pick never hangs on being kept', async () => {
    await recordPick({ userId: 'user-1', gameId: 7, mode: 'play', attempt: 1 });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['the server has no key', () => (hasKey = false)],
    [
      'the table refuses it',
      () => (answer = { data: null, error: { message: 'relation does not exist' } }),
    ],
    ['the database gives no id back', () => (answer = { data: null, error: null })],
    ['the request itself fails', () => (throws = true)],
  ])('gives null, and throws nothing, when %s', async (_, arrange) => {
    arrange();
    await expect(
      recordPick({ userId: 'user-1', gameId: 7, mode: 'play', attempt: 1 }),
    ).resolves.toBeNull();
  });
});

describe('recordPickOutcome', () => {
  it("sets the outcome on the player's own pick, and only while it has none", async () => {
    await recordPickOutcome('user-1', 41, 'queued');
    expect(calls).toEqual([
      ['from', 'game_picks'],
      ['update', { outcome: 'queued', answered_at: NOW }],
      ['eq', 'id', 41],
      ['eq', 'user_id', 'user-1'],
      ['is', 'outcome', null],
    ]);
  });

  it('can be held to a pick of one game, as a reroll is', async () => {
    await recordPickOutcome('user-1', 41, 'rerolled', 7);
    expect(calls.slice(2)).toEqual([
      ['eq', 'id', 41],
      ['eq', 'user_id', 'user-1'],
      ['is', 'outcome', null],
      ['eq', 'game_id', 7],
    ]);
  });

  it('gives the write a time limit', async () => {
    await recordPickOutcome('user-1', 41, 'queued');
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['the server has no key', () => (hasKey = false)],
    ['the table refuses it', () => (answer = { data: null, error: { message: 'no such table' } })],
    ['the request itself fails', () => (throws = true)],
  ])('throws nothing when %s', async (_, arrange) => {
    arrange();
    await expect(recordPickOutcome('user-1', 41, 'played')).resolves.toBeUndefined();
  });
});
