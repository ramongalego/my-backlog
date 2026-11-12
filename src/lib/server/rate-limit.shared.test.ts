/**
 * @jest-environment node
 */
import { checkSharedRateLimit } from '@/lib/server/rate-limit';

// What the database's counter answers, or an error, or no service key at all.
let rpc: (() => { data: unknown; error: unknown }) | null = null;
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () =>
    rpc && { rpc: () => ({ single: async () => (rpc as NonNullable<typeof rpc>)() }) },
}));

const LIMIT = { limit: 2, windowMs: 60_000 };
let key = 0;
const nextKey = () => `test:${++key}`;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

it("uses the database's count, which every server instance shares", async () => {
  rpc = () => ({
    data: { allowed: false, remaining: 0, reset_at: '2026-11-12T00:00:00Z' },
    error: null,
  });
  expect(await checkSharedRateLimit(nextKey(), LIMIT)).toMatchObject({
    success: false,
    remaining: 0,
  });
});

it('counts in memory when the database counter is unavailable', async () => {
  rpc = () => ({ data: null, error: new Error('function not found') });
  const id = nextKey();
  expect((await checkSharedRateLimit(id, LIMIT)).success).toBe(true);
  expect((await checkSharedRateLimit(id, LIMIT)).success).toBe(true);
  expect((await checkSharedRateLimit(id, LIMIT)).success).toBe(false);
});

describe('a spending budget (failClosed)', () => {
  it('is refused in production when it cannot be counted, rather than counted per instance', async () => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });

    rpc = () => ({ data: null, error: new Error('timeout') });
    expect((await checkSharedRateLimit(nextKey(), LIMIT, { failClosed: true })).success).toBe(
      false,
    );

    rpc = null; // no service key
    expect((await checkSharedRateLimit(nextKey(), LIMIT, { failClosed: true })).success).toBe(
      false,
    );
  });

  it('still works from the database count in production', async () => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });
    rpc = () => ({
      data: { allowed: true, remaining: 1, reset_at: '2026-11-12T00:00:00Z' },
      error: null,
    });
    expect((await checkSharedRateLimit(nextKey(), LIMIT, { failClosed: true })).success).toBe(true);
  });

  it('falls back to memory outside production, so development works without the key', async () => {
    rpc = null;
    expect((await checkSharedRateLimit(nextKey(), LIMIT, { failClosed: true })).success).toBe(true);
  });
});
