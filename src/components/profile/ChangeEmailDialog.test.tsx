import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { ChangeEmailDialog } from '@/components/profile/ChangeEmailDialog';
import type { EmailChangeResult } from '@/lib/client/account';

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

const onSubmit = jest.fn<Promise<EmailChangeResult>, [string]>();
const onClose = jest.fn();

const open = () =>
  render(<ChangeEmailDialog email="player@example.com" onSubmit={onSubmit} onClose={onClose} />);
const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('New email'), { target: { value } });
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

it('asks for the change, says to check both inboxes, and closes', async () => {
  open();
  type('new@example.com');
  await act(async () => fireEvent.click(submit()));

  expect(onSubmit).toHaveBeenCalledWith('new@example.com');
  expect(toast.success).toHaveBeenCalledWith('Check your email', {
    description:
      "We sent links to player@example.com and new@example.com. Your email changes once you've opened both.",
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('says the email is changed when there was nothing to confirm', async () => {
  onSubmit.mockResolvedValue({ ok: true, email: 'new@example.com', pendingEmail: null });
  open();
  type('new@example.com');
  await act(async () => fireEvent.click(submit()));
  expect(toast.success).toHaveBeenCalledWith('Your email is now new@example.com');
});

it('sends once, however many times it is pressed', async () => {
  let done!: (result: EmailChangeResult) => void;
  onSubmit.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  type('new@example.com');
  await act(async () => {
    fireEvent.click(submit());
    fireEvent.click(submit());
    fireEvent.click(submit());
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true, email: null, pendingEmail: 'new@example.com' }));
});

it('refuses an empty, invalid or unchanged email without sending', async () => {
  open();
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Email is required')).toBeInTheDocument();

  type('nope');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();

  type('Player@Example.com');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText("That's already your email")).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("shows the server's refusal under the field, and stays open", async () => {
  onSubmit.mockResolvedValue({
    ok: false,
    error: 'That email already has an account',
    field: 'email',
  });
  open();
  type('taken@example.com');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByLabelText('New email')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('That email already has an account')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it('shows a refusal about no field above the form', async () => {
  onSubmit.mockResolvedValue({
    ok: false,
    error: "We can't send another email right now. Please try again in an hour.",
  });
  open();
  type('new@example.com');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByRole('alert')).toHaveTextContent("We can't send another email right now.");
});
