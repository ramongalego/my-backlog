import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => '/home' }));
jest.mock('sonner', () => ({
  toast: { loading: jest.fn(() => 'progress'), dismiss: jest.fn() },
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u', email: 'player@example.com' },
    profile: { steam_id: '1', steam_username: 'Player', steam_avatar: null },
    authResolved: true,
  }),
}));
jest.mock('@/hooks/useLibraryMeta', () => ({
  useLibraryMeta: () => ({ gameCount: 3, loaded: true }),
}));
jest.mock('@/hooks/useLibraryRefresh', () => ({
  useLibraryRefresh: () => ({ refresh }),
  refreshKeys: () => ({
    playtime: 'playtime',
    manual: 'manual',
    attempt: 'attempt',
    reviews: 'reviews',
  }),
}));
jest.mock('@/components/games/AddGameButton', () => ({ AddGameButton: () => null }));
jest.mock('@/components/auth/AuthModal', () => ({ AuthModal: () => null }));
// The menu has its own tests; here it's what Refresh library does.
jest.mock('@/components/layout/UserMenu', () => ({
  UserMenu: ({
    onRefresh,
    isRefreshDisabled,
  }: {
    onRefresh?: () => void;
    isRefreshDisabled?: boolean;
  }) => (
    <button onClick={onRefresh} data-cooldown={isRefreshDisabled ? 'on' : 'off'}>
      Refresh library
    </button>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

it('refreshes the library once, however many times Refresh is pressed', async () => {
  let done!: (result: { success: boolean }) => void;
  refresh.mockReturnValue(new Promise((resolve) => (done = resolve)));
  render(<Header />);
  const button = screen.getByRole('button', { name: 'Refresh library' });

  await act(async () => {
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
  });

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(toast.loading).toHaveBeenCalledTimes(1);

  // And again once that one is done.
  await act(async () => done({ success: false }));
  await act(async () => {
    fireEvent.click(button);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
});

describe('the cooldown after a refresh', () => {
  const button = () => screen.getByRole('button', { name: 'Refresh library' });

  it('follows a refresh the player asked for', () => {
    localStorage.setItem('manual', String(Date.now() - 30_000));
    render(<Header />);
    expect(button()).toHaveAttribute('data-cooldown', 'on');
  });

  it("isn't started by a background refresh: that one wasn't theirs", () => {
    // The page loads half a minute after the app refreshed on its own.
    localStorage.setItem('playtime', String(Date.now() - 30_000));
    render(<Header />);
    expect(button()).toHaveAttribute('data-cooldown', 'off');
  });

  it('is over two minutes after the last one', () => {
    localStorage.setItem('manual', String(Date.now() - 3 * 60_000));
    render(<Header />);
    expect(button()).toHaveAttribute('data-cooldown', 'off');
  });
});
