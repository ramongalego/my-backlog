import { act, fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { UserMenu } from '@/components/layout/UserMenu';
import { useConnectSteam } from '@/hooks/useConnectSteam';
import { connectSteam } from '@/lib/client/steam-connect';

jest.mock('@/lib/client/steam-connect', () => ({ connectSteam: jest.fn() }));

const signOut = jest.fn(async () => ({ error: null }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }));
jest.mock('@/lib/reload', () => ({ reloadAtTop: jest.fn() }));

const user = { id: 'u', email: 'player@example.com' } as User;

it('closes as soon as a refresh starts', () => {
  const onRefresh = jest.fn();
  render(<UserMenu user={user} name="Player" avatar={null} onRefresh={onRefresh} />);

  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Refresh library' }));

  expect(onRefresh).toHaveBeenCalled();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('tells the header when it opens, so the nav menu can close', () => {
  const onOpen = jest.fn();
  render(<UserMenu user={user} name="Player" avatar={null} onOpen={onOpen} />);

  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('menu')).toBeInTheDocument();

  // Closing it isn't an open.
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("leads to the player's profile at its own address, and closes on the way", () => {
  render(<UserMenu user={user} name="Player" avatar={null} profileHref="/u/player" />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));

  const profile = screen.getByRole('menuitem', { name: 'Profile' });
  expect(profile).toHaveAttribute('href', '/u/player');
  // The first thing in the menu, so opening it lands there.
  expect(profile).toHaveFocus();

  fireEvent.click(profile);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('leads to Settings, right under Profile, and closes on the way', () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));

  const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
  expect(items.slice(0, 2)).toEqual(['Profile', 'Settings']);
  const settings = screen.getByRole('menuitem', { name: 'Settings' });
  expect(settings).toHaveAttribute('href', '/settings');

  fireEvent.click(settings);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open user menu' })).toHaveFocus();
});

it('holds the pages and actions of the account, and no link to support the app', () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));

  // That link lives in the footer only.
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
    'Profile',
    'Settings',
    'Report an issue',
    'Sign out',
  ]);
});

it('moves through its items with the arrow keys, the link included', () => {
  render(<UserMenu user={user} name="Player" avatar={null} onRefresh={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  const menu = screen.getByRole('menu');

  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Refresh library' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
});

it('has a chevron beside the avatar that turns over while the menu is open', () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  const trigger = screen.getByRole('button', { name: 'Open user menu' });
  const chevron = trigger.querySelector('svg')!;
  expect(chevron).toHaveAttribute('aria-hidden', 'true');
  expect(chevron).not.toHaveClass('rotate-180');

  fireEvent.click(trigger);
  expect(chevron).toHaveClass('rotate-180');
  fireEvent.click(trigger);
  expect(chevron).not.toHaveClass('rotate-180');
});

it('activates the Profile link with Space, as the buttons beside it do', () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  const profile = screen.getByRole('menuitem', { name: 'Profile' });
  const clicked = jest.fn((e: Event) => e.preventDefault());
  profile.addEventListener('click', clicked);
  fireEvent.keyDown(profile, { key: ' ' });
  expect(clicked).toHaveBeenCalledTimes(1);
});

it('gives focus back to its button when Profile is chosen, wherever that leads', () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  const trigger = screen.getByRole('button', { name: 'Open user menu' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Profile' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('draws the whole first character of a name as the initial, an emoji included', () => {
  render(<UserMenu user={user} name="🎮 Ramon" avatar={null} />);
  expect(screen.getByRole('button', { name: 'Open user menu' })).toHaveTextContent('🎮');
});

it('draws the initial when the picture will not load', () => {
  const { container } = render(
    <UserMenu user={user} name="Player" avatar="https://avatars.steamstatic.com/gone.jpg" />,
  );
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open user menu' })).toHaveTextContent('P');
});

it('says how long until Refresh library can be used again', () => {
  jest.useFakeTimers();
  localStorage.setItem('manual_refresh_at:u', String(Date.now() - 30_000));
  render(
    <UserMenu user={user} name="Player" avatar={null} onRefresh={jest.fn()} isRefreshDisabled />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByRole('menuitem', { name: 'Available in 2 minutes' })).toBeDisabled();
  // Thirty seconds on, a minute and a half is left... then a minute.
  act(() => jest.advanceTimersByTime(31_000));
  expect(screen.getByRole('menuitem', { name: 'Available in 1 minute' })).toBeDisabled();
  jest.useRealTimers();
  localStorage.clear();
});

it('marks Connect Steam busy once it has been pressed, and leaves for Steam once', () => {
  function Menu() {
    const { connect } = useConnectSteam();
    return <UserMenu user={user} name="Player" avatar={null} onConnectSteam={connect} />;
  }
  render(<Menu />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  const item = screen.getByRole('menuitem', { name: 'Connect Steam' });
  expect(item).not.toHaveAttribute('aria-busy');

  fireEvent.click(item);
  fireEvent.click(item);
  expect(item).toHaveAttribute('aria-busy', 'true');
  expect(item.querySelector('.animate-spin')).toBeInTheDocument();
  expect(item).toBeEnabled();
  expect(connectSteam).toHaveBeenCalledTimes(1);

  act(() => {
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  });
});

it('signs out of this browser only, not every device the account is on', async () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  });
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('leads to /profile, which finds the address, until the username is known', () => {
  render(<UserMenu user={user} name="Player" avatar={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/profile');
});
