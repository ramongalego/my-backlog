import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpdateSessionProfile } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const key = queryKeys.auth.session();
const user = { id: 'user-1', email: 'player@example.com' };
const steam = {
  steam_id: '7656',
  steam_username: 'Ankrath',
  steam_avatar: 'https://avatars.steamstatic.com/a_full.jpg',
  display_name: null,
  avatar_url: null,
};

function setup(session: unknown) {
  const client = new QueryClient();
  if (session !== undefined) client.setQueryData(key, session);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useUpdateSessionProfile(), { wrapper });
  return { hook, client, session: () => client.getQueryData<{ profile: unknown }>(key) };
}

describe('useUpdateSessionProfile', () => {
  it('changes only what it is given, in the session the whole app reads', () => {
    const { hook, session } = setup({ user, profile: steam });
    act(() => hook.result.current({ display_name: 'Big Boss' }));
    expect(session()).toEqual({ user, profile: { ...steam, display_name: 'Big Boss' } });
  });

  it('merges one change after another, so two at once both land', () => {
    const { hook, session } = setup({ user, profile: steam });
    act(() => {
      hook.result.current({ avatar_url: 'https://x/mine.webp' });
      hook.result.current({ steam_username: 'mistkai' });
    });
    expect(session()?.profile).toEqual({
      ...steam,
      avatar_url: 'https://x/mine.webp',
      steam_username: 'mistkai',
    });
  });

  it('makes a whole profile for an account that had none', () => {
    const { hook, session } = setup({ user, profile: null });
    act(() => hook.result.current({ display_name: 'Snake' }));
    expect(session()?.profile).toEqual({
      steam_id: null,
      steam_username: null,
      steam_avatar: null,
      display_name: 'Snake',
      avatar_url: null,
    });
  });

  it('does nothing without a session to change', () => {
    const { hook, session } = setup(undefined);
    act(() => hook.result.current({ display_name: 'Snake' }));
    expect(session()).toBeUndefined();
  });

  it('cancels a read of the session on its way, which would put the old profile back', () => {
    const { hook, client } = setup({ user, profile: steam });
    const cancel = jest.spyOn(client, 'cancelQueries');
    act(() => hook.result.current({ display_name: 'Big Boss' }));
    expect(cancel).toHaveBeenCalledWith({ queryKey: key }, { revert: false });
  });

  it('is the same function from one render to the next, so effects that depend on it do not re-run', () => {
    const { hook } = setup({ user, profile: steam });
    const first = hook.result.current;
    hook.rerender();
    expect(hook.result.current).toBe(first);
  });
});
