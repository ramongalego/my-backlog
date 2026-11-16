import type { SupabaseClient } from '@supabase/supabase-js';
import { leaveDeadSession, sessionIsGone } from '@/lib/client/dead-session';

const signOut = jest.fn(async () => ({ error: null }));
const supabase = { auth: { signOut } } as unknown as Pick<SupabaseClient, 'auth'>;
const leave = jest.fn();
const on = (pathname: string) => ({ pathname, leave });

/** The account was deleted on another device: the cookie is still good, the user isn't there. */
const accountGone = { name: 'AuthApiError', status: 403, code: 'user_not_found' };
/** Signed out from another device: Supabase's client has already cleared the session. */
const sessionMissing = { name: 'AuthSessionMissingError', status: 400 };

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe('sessionIsGone', () => {
  it('is when Supabase answered that there is no such session', () => {
    expect(sessionIsGone(accountGone)).toBe(true);
    expect(sessionIsGone(sessionMissing)).toBe(true);
    expect(sessionIsGone({ name: 'AuthApiError', status: 401 })).toBe(true);
  });

  it("isn't when Supabase couldn't be asked: nobody is signed out for a dropped connection", () => {
    expect(sessionIsGone({ name: 'AuthRetryableFetchError', status: 0 })).toBe(false);
    expect(sessionIsGone({ name: 'AuthUnknownError' })).toBe(false);
    expect(sessionIsGone({ name: 'AuthApiError', status: 503 })).toBe(false);
    expect(sessionIsGone({ name: 'AuthApiError', status: 429 })).toBe(false);
  });
});

describe('leaveDeadSession', () => {
  it('clears the cookies of an account that is gone, and leaves a signed-in page', async () => {
    await leaveDeadSession(supabase, accountGone, on('/home'));
    // Only this browser's: there is no session left on the server to end.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('leaves without signing out again when the session was already cleared', async () => {
    await leaveDeadSession(supabase, sessionMissing, on('/profile'));
    expect(signOut).not.toHaveBeenCalled();
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('stays put on a page that needs no session, as a signed-out visitor is on the landing page', async () => {
    await leaveDeadSession(supabase, sessionMissing, on('/'));
    expect(signOut).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();

    // Its cookies are cleared all the same when the account is gone.
    await leaveDeadSession(supabase, accountGone, on('/share/abc'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(leave).not.toHaveBeenCalled();
  });

  it("does nothing when Supabase couldn't be asked", async () => {
    await leaveDeadSession(supabase, { name: 'AuthRetryableFetchError', status: 0 }, on('/home'));
    expect(signOut).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('leaves once, not in a loop, if it finds itself back on a signed-in page', async () => {
    await leaveDeadSession(supabase, accountGone, on('/home'));
    await leaveDeadSession(supabase, accountGone, on('/home'));
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('still leaves when clearing the cookies fails', async () => {
    signOut.mockRejectedValueOnce(new Error('offline'));
    await leaveDeadSession(supabase, accountGone, on('/games'));
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
