import { act, fireEvent, render, screen } from '@testing-library/react';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { createClient } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

it('asks for one reset link, however many times the form is submitted', async () => {
  let answer!: (value: unknown) => void;
  const resetPasswordForEmail = jest.fn(() => new Promise((resolve) => (answer = resolve)));
  jest.mocked(createClient).mockReturnValue({ auth: { resetPasswordForEmail } } as never);
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
  const form = screen.getByLabelText(/email/i).closest('form')!;

  await act(async () => {
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  await act(async () => answer({ error: null }));

  expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
});

it('says an email is needed without asking for a link', async () => {
  const resetPasswordForEmail = jest.fn();
  jest.mocked(createClient).mockReturnValue({ auth: { resetPasswordForEmail } } as never);
  render(<ForgotPasswordForm />);

  await act(async () => {
    fireEvent.submit(screen.getByLabelText(/email/i).closest('form')!);
  });

  expect(screen.getByText('Email is required')).toBeInTheDocument();
  expect(resetPasswordForEmail).not.toHaveBeenCalled();
});
