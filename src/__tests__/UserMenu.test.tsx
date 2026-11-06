import { fireEvent, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { UserMenu } from '@/components/UserMenu';

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
