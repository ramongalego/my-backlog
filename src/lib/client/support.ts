// Client helper for /api/support (the "Report an issue" form).

export type TicketType = 'bug' | 'feedback' | 'support';

/**
 * Sends a support ticket. Throws with a message to show the player if it
 * wasn't saved: the server's own (too short, too many tickets), or that the
 * request never got there.
 */
export async function sendSupportTicket(type: TicketType, message: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message }),
    });
  } catch {
    throw new Error('Failed to submit. Please check your connection and try again.');
  }
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? 'Failed to submit');
}
