import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ChangeEmailDialog } from '@/components/profile/ChangeEmailDialog';
import type { EmailChangeResult } from '@/lib/client/account';

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

const onSubmit = jest.fn<Promise<EmailChangeResult>, [string, string]>();
const onClose = jest.fn();

const open = () =>
  render(<ChangeEmailDialog email="player@example.com" onSubmit={onSubmit} onClose={onClose} />);
const email = () => screen.getByLabelText('New email');
const password = () => screen.getByLabelText('Your password, to confirm');
const fill = (address: string, pass = 'My-pass1') => {
  fireEvent.change(email(), { target: { value: address } });
  fireEvent.change(password(), { target: { value: pass } });
};
const submit = () => screen.getByRole('button', { name: 'Send confirmation' });

beforeEach(() => {
  jest.clearAllMocks();
  onSubmit.mockResolvedValue({
    ok: true,
    email: 'player@example.com',
    pendingEmail: 'new@example.com',
  });
});

it('says what the email is now and how a change is made', () => {
  open();
  expect(screen.getByRole('dialog', { name: 'Change email' })).toHaveTextContent(
    "It's player@example.com now. We'll email links to confirm the change",
  );
});

it('asks for the change with the password, says to check both inboxes, and closes', async () => {
  open();
  fill('new@example.com');
  await act(async () => fireEvent.click(submit()));

  expect(onSubmit).toHaveBeenCalledWith('new@example.com', 'My-pass1');
  expect(toast.success).toHaveBeenCalledWith('Check your email', {
    description:
      "We sent links to player@example.com and new@example.com. Your email changes once you've opened both.",
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('says the email is changed when there was nothing to confirm', async () => {
  onSubmit.mockResolvedValue({ ok: true, email: 'new@example.com', pendingEmail: null });
  open();
  fill('new@example.com');
  await act(async () => fireEvent.click(submit()));
  expect(toast.success).toHaveBeenCalledWith('Your email is now new@example.com');
});

it('sends once, however many times it is pressed', async () => {
  let done!: (result: EmailChangeResult) => void;
  onSubmit.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  fill('new@example.com');
  await act(async () => {
    fireEvent.click(submit());
    fireEvent.click(submit());
    fireEvent.click(submit());
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true, email: null, pendingEmail: 'new@example.com' }));
});

it('refuses an empty, invalid or unchanged email, and a missing password, without sending', async () => {
  open();
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Email is required')).toBeInTheDocument();
  expect(screen.getByText('Enter your password')).toBeInTheDocument();

  fill('nope');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();

  fill('Player@Example.com');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText("That's already your email")).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("shows the server's refusal under the field it's about, and stays open", async () => {
  onSubmit.mockResolvedValueOnce({
    ok: false,
    error: 'That email already has an account',
    field: 'email',
  });
  open();
  fill('taken@example.com');
  await act(async () => fireEvent.click(submit()));
  expect(email()).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('That email already has an account')).toBeInTheDocument();

  onSubmit.mockResolvedValueOnce({
    ok: false,
    error: "That isn't your password",
    field: 'password',
  });
  await act(async () => fireEvent.click(submit()));
  expect(password()).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText("That isn't your password")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it('shows a refusal about no field above the form', async () => {
  onSubmit.mockResolvedValue({
    ok: false,
    error: "We can't send another email right now. Please try again in an hour.",
  });
  open();
  fill('new@example.com');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByRole('alert')).toHaveTextContent("We can't send another email right now.");
});

it('lets a long address break, so it stays inside the dialog on a phone', () => {
  open();
  expect(screen.getByText('player@example.com')).toHaveClass('[overflow-wrap:anywhere]');
});

it('starts on its title, not in a field, with the first field one Tab on', async () => {
  open();
  // The dialog moves focus in on the next frame.
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(screen.getByRole('heading', { name: 'Change email' })).toHaveFocus();

  await userEvent.tab();
  expect(screen.getByLabelText('New email')).toHaveFocus();
});
