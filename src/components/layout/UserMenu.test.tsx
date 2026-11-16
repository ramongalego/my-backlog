import { fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { UserMenu } from '@/components/layout/UserMenu';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

const user = { id: 'u', email: 'player@example.com' } as User;

it('closes as soon as a refresh starts', () => {
  const onRefresh = jest.fn();
  render(<UserMenu user={user} steamUsername="Player" steamAvatar={null} onRefresh={onRefresh} />);

  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Refresh library' }));

  expect(onRefresh).toHaveBeenCalled();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('tells the header when it opens, so the nav menu can close', () => {
  const onOpen = jest.fn();
  render(<UserMenu user={user} steamUsername="Player" steamAvatar={null} onOpen={onOpen} />);

  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('menu')).toBeInTheDocument();

  // Closing it isn't an open.
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('leads to the profile, and closes on the way', () => {
  render(<UserMenu user={user} steamUsername="Player" steamAvatar={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));

  const profile = screen.getByRole('menuitem', { name: 'Profile' });
  expect(profile).toHaveAttribute('href', '/profile');
  // The first thing in the menu, so opening it lands there.
  expect(profile).toHaveFocus();

  fireEvent.click(profile);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('moves through its items with the arrow keys, the link included', () => {
  render(<UserMenu user={user} steamUsername="Player" steamAvatar={null} onRefresh={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
  const menu = screen.getByRole('menu');

  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Refresh library' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
});

it('has a chevron beside the avatar that turns over while the menu is open', () => {
  render(<UserMenu user={user} steamUsername="Player" steamAvatar={null} />);
  const trigger = screen.getByRole('button', { name: 'Open user menu' });
  const chevron = trigger.querySelector('svg')!;
  // Decoration: the button already says what it opens.
  expect(chevron).toHaveAttribute('aria-hidden', 'true');
  expect(chevron).not.toHaveClass('rotate-180');

  fireEvent.click(trigger);
  expect(chevron).toHaveClass('rotate-180');
  fireEvent.click(trigger);
  expect(chevron).not.toHaveClass('rotate-180');
});
