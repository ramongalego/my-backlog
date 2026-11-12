/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/support/route';

let user: { id: string } | null = { id: 'user-1' };
let limited = false;
let insertError: Error | null = null;
const tickets: Record<string, unknown>[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (!insertError) tickets.push(row);
        return { error: insertError };
      },
    }),
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({
    success: !limited,
    limit: 10,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  }),
}));

const send = (body: unknown) =>
  POST(
    new Request('http://localhost/api/support', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );

const ticket = { type: 'bug', message: 'The queue jumps when I drag a game.' };

beforeEach(() => {
  user = { id: 'user-1' };
  limited = false;
  insertError = null;
  tickets.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await send(ticket)).status).toBe(401);
  expect(tickets).toEqual([]);
});

it('saves the ticket for the signed-in player', async () => {
  const res = await send(ticket);
  expect(res.status).toBe(200);
  expect(tickets).toEqual([{ user_id: 'user-1', ...ticket }]);
});

it('takes HTML tags out of the message before saving it', async () => {
  await send({ type: 'feedback', message: '<script>alert(1)</script>Please add <b>dark</b> mode' });
  expect(tickets[0].message).toBe('alert(1)Please add dark mode');
});

it.each([
  ['a body that is not JSON', '{', 'Invalid JSON'],
  ['a kind of ticket that does not exist', { ...ticket, type: 'spam' }, 'Invalid type'],
  ['a message that is too short', { ...ticket, message: 'Broken' }, /at least 10/],
  [
    'a message that is only tags, once they are taken out',
    { ...ticket, message: '<p></p><div></div>' },
    /at least 10/,
  ],
  ['a message that is too long', { ...ticket, message: 'x'.repeat(2001) }, /at most 2000/],
])('refuses %s', async (_, body, error) => {
  const res = await send(body);
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(error);
  expect(tickets).toEqual([]);
});

it('stops a player past the limit, and says when to try again', async () => {
  limited = true;
  const res = await send(ticket);
  expect(res.status).toBe(429);
  expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  expect(tickets).toEqual([]);
});

it("says so when the ticket couldn't be saved", async () => {
  insertError = new Error('db down');
  const res = await send(ticket);
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Failed to submit ticket' });
});
