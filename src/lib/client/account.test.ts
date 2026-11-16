import {
  changeEmail,
  changePassword,
  deleteAccount,
  disconnectSteam,
  downloadData,
  sendPasswordReset,
} from '@/lib/client/account';
import { saveFile } from '@/lib/client/save-file';

jest.mock('@/lib/client/save-file', () => ({ saveFile: jest.fn() }));

const resetPasswordForEmail = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail } }),
}));

const answer = (status: number, body: unknown) =>
  (global.fetch = jest.fn(
    async () => ({ ok: status < 300, status, json: async () => body }) as unknown as Response,
  ));

beforeEach(() => jest.clearAllMocks());

describe('changePassword', () => {
  it('sends the current and new password', async () => {
    answer(200, { ok: true });
    expect(await changePassword('Old-pass1', 'New-pass1')).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/account/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'Old-pass1', newPassword: 'New-pass1' }),
      }),
    );
  });

  it("gives back the server's message and the field it's about", async () => {
    answer(400, { error: "That isn't your current password", field: 'currentPassword' });
    expect(await changePassword('x', 'New-pass1')).toEqual({
      ok: false,
      error: "That isn't your current password",
      field: 'currentPassword',
    });
  });

  it("says how long to wait when the app's limit stops it", async () => {
    answer(429, { error: 'Too many requests' });
    expect(await changePassword('x', 'New-pass1')).toEqual({
      ok: false,
      error: 'Too many tries. Please wait 15 minutes and try again.',
    });
  });

  it('says so when the server can not be reached', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('offline');
    });
    expect(await changePassword('x', 'New-pass1')).toEqual({
      ok: false,
      error: "Couldn't reach MyBacklog. Check your connection and try again.",
    });
  });
});

describe('changeEmail', () => {
  it('gives back the email waiting for its link', async () => {
    answer(200, { email: 'player@example.com', pendingEmail: 'new@example.com' });
    expect(await changeEmail('new@example.com', 'My-pass1')).toEqual({
      ok: true,
      email: 'player@example.com',
      pendingEmail: 'new@example.com',
    });
  });

  it("keeps Supabase's own rate limit message, which says more than the app's", async () => {
    const error = "We can't send another email right now. Please try again in an hour.";
    answer(429, { error });
    expect(await changeEmail('new@example.com', 'My-pass1')).toEqual({ ok: false, error });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/account/email',
      expect.objectContaining({
        body: JSON.stringify({ email: 'new@example.com', password: 'My-pass1' }),
      }),
    );
  });
});

describe('sendPasswordReset', () => {
  it('emails a link that lands on the reset page', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await sendPasswordReset('player@example.com')).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith('player@example.com', {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
  });

  it('is false when it could not be sent', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'rate limit' } });
    expect(await sendPasswordReset('player@example.com')).toBe(false);
  });
});

describe('deleteAccount', () => {
  it('sends the password to confirm it', async () => {
    answer(200, { ok: true });
    expect(await deleteAccount('My-pass1')).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/account/delete',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'My-pass1' }) }),
    );
  });

  it("gives back a wrong password on the password's field", async () => {
    answer(400, { error: "That isn't your password", field: 'password' });
    expect(await deleteAccount('x')).toEqual({
      ok: false,
      error: "That isn't your password",
      field: 'password',
    });
  });
});

describe('disconnectSteam', () => {
  it('asks the server to unlink Steam', async () => {
    answer(200, { ok: true });
    expect(await disconnectSteam()).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/steam/disconnect',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('downloadData', () => {
  const file = { size: 12 } as Blob;
  const fileAnswer = (disposition: string | null) =>
    (global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: { get: (name: string) => (name === 'Content-Disposition' ? disposition : null) },
          blob: async () => file,
        }) as unknown as Response,
    ));

  it('fetches the file asked for and saves it under the name the server gave it', async () => {
    fileAnswer('attachment; filename="mybacklog-games-2026-11-16.csv"');
    expect(await downloadData('csv')).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('/api/account/export?format=csv');
    expect(saveFile).toHaveBeenCalledWith(file, 'mybacklog-games-2026-11-16.csv');
  });

  it('names the file itself when the server did not', async () => {
    fileAnswer(null);
    await downloadData('json');
    expect(saveFile).toHaveBeenCalledWith(
      file,
      expect.stringMatching(/^mybacklog-data-\d{4}-\d{2}-\d{2}\.json$/),
    );
  });

  it('saves nothing and says why when the server refuses', async () => {
    answer(500, { error: "Couldn't prepare your data. Please try again." });
    expect(await downloadData('json')).toEqual({
      ok: false,
      error: "Couldn't prepare your data. Please try again.",
    });
    answer(429, { error: 'Too many requests' });
    expect(await downloadData('json')).toEqual({
      ok: false,
      error: 'Too many downloads. Please try again in an hour.',
    });
    expect(saveFile).not.toHaveBeenCalled();
  });

  it('says so when the app could not be reached, or the file stopped partway', async () => {
    const offline = "Couldn't reach MyBacklog. Check your connection and try again.";
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await downloadData('csv')).toEqual({ ok: false, error: offline });

    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: { get: () => null },
          blob: async () => {
            throw new TypeError('network error');
          },
        }) as unknown as Response,
    );
    expect(await downloadData('csv')).toEqual({ ok: false, error: offline });
    expect(saveFile).not.toHaveBeenCalled();
  });
});
