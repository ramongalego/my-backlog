import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthModal } from '@/components/auth/AuthModal';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {} }) }));

it('moves focus to the new title when the form is switched, instead of losing it', () => {
  render(<AuthModal isOpen onClose={jest.fn()} initialMode="login" />);
  const toSignUp = screen.getByRole('button', { name: 'Sign up' });
  toSignUp.focus();

  fireEvent.click(toSignUp);

  // The link that was pressed is gone with the old form.
  expect(screen.getByRole('heading', { name: 'Create Account' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('heading', { name: 'Welcome Back' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  expect(screen.getByRole('heading', { name: 'Reset Password' })).toHaveFocus();
});

it('names the dialog by its title, and marks every field as required', () => {
  render(<AuthModal isOpen onClose={jest.fn()} initialMode="signup" />);

  expect(screen.getByRole('dialog', { name: 'Create Account' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeRequired();
  expect(screen.getByLabelText('Password')).toBeRequired();
  expect(screen.getByLabelText('Confirm Password')).toBeRequired();
});

it('starts on its title, not in a field, with the first button one Tab on', async () => {
  render(<AuthModal isOpen onClose={() => {}} initialMode="login" />);
  // The dialog moves focus in on the next frame.
  await act(async () => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  expect(screen.getByRole('heading', { name: 'Welcome Back' })).toHaveFocus();
  expect(screen.getByLabelText('Email')).not.toHaveFocus();

  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveFocus();
});

it('starts on its title for creating an account too', async () => {
  render(<AuthModal isOpen onClose={() => {}} initialMode="signup" />);
  await act(async () => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  expect(screen.getByRole('heading', { name: 'Create Account' })).toHaveFocus();
});
