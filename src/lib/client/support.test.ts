import { sendSupportTicket } from '@/lib/client/support';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

it('posts the ticket', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true });

  await sendSupportTicket('bug', 'The queue jumps when I drag a game.');

  expect(mockFetch).toHaveBeenCalledWith('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'bug', message: 'The queue jumps when I drag a game.' }),
  });
});

it("throws with the server's reason when the ticket is refused", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 429,
    json: async () => ({ error: 'Too many tickets submitted. Please try again later.' }),
  });

  await expect(sendSupportTicket('feedback', 'More sorting options, please.')).rejects.toThrow(
    'Too many tickets submitted. Please try again later.',
  );
});

it('throws a plain message when the error has no reason to give', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 502,
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  });

  await expect(sendSupportTicket('support', 'I cannot sign in on my phone.')).rejects.toThrow(
    'Failed to submit',
  );
});

it('says to check the connection when the request never got there', async () => {
  mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

  await expect(sendSupportTicket('bug', 'Nothing loads on the train.')).rejects.toThrow(
    /check your connection/,
  );
});
