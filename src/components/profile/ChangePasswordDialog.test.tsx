import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog';
import type { AccountResult } from '@/lib/client/account';

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

const onSubmit = jest.fn<Promise<AccountResult>, [string, string]>();
const onSendReset = jest.fn<Promise<boolean>, []>();
const onClose = jest.fn();

const open = () =>
  render(
    <ChangePasswordDialog
      email="player@example.com"
      onSubmit={onSubmit}
      onSendReset={onSendReset}
      onClose={onClose}
    />,
  );
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = (current = 'Old-pass1', next = 'New-pass1', confirm = next) => {
  type('Current password', current);
  type('New password', next);
  type('Confirm new password', confirm);
};
const submit = () => screen.getByRole('button', { name: 'Change password' });

beforeEach(() => {
  jest.clearAllMocks();
  onSubmit.mockResolvedValue({ ok: true });
  onSendReset.mockResolvedValue(true);
});

it('changes it, says so, and closes', async () => {
  open();
  expect(screen.getByRole('dialog', { name: 'Change password' })).toBeInTheDocument();
  fill();
  await act(async () => fireEvent.click(submit()));

  expect(onSubmit).toHaveBeenCalledWith('Old-pass1', 'New-pass1');
  expect(toast.success).toHaveBeenCalledWith(
    'Password changed. Your other devices are signed out.',
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('sends once, however many times it is pressed', async () => {
  let done!: (result: AccountResult) => void;
  onSubmit.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  fill();
  await act(async () => {
    fireEvent.click(submit());
    fireEvent.click(submit());
    fireEvent.click(submit());
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true }));
});

it('says what is missing or wrong under each field, without sending', async () => {
  open();
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Enter your current password')).toBeInTheDocument();
  expect(screen.getByText('Password is required')).toBeInTheDocument();

  fill('Old-pass1', 'New-pass1', 'Other-pass1');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

  fill('Same-pass1', 'Same-pass1');
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText("That's your current password. Pick a new one")).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("shows the server's refusal on the field it's about, and stays open", async () => {
  onSubmit.mockResolvedValue({
    ok: false,
    error: "That isn't your current password",
    field: 'currentPassword',
  });
  open();
  fill();
  await act(async () => fireEvent.click(submit()));

  const current = screen.getByLabelText('Current password');
  expect(current).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText("That isn't your current password")).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();

  // Typing again clears what was said about the last try.
  type('Current password', 'Old-pass2');
  expect(screen.queryByText("That isn't your current password")).not.toBeInTheDocument();
});

it('shows a refusal about no field above the form', async () => {
  onSubmit.mockResolvedValue({ ok: false, error: 'Too many tries. Please wait 15 minutes.' });
  open();
  fill();
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByRole('alert')).toHaveTextContent('Too many tries. Please wait 15 minutes.');
});

describe('a forgotten password', () => {
  const resetButton = () => screen.getByRole('button', { name: 'Email me a reset link' });

  it('emails a reset link, once, and says where it went', async () => {
    open();
    await act(async () => {
      fireEvent.click(resetButton());
      fireEvent.click(resetButton());
    });
    expect(onSendReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Reset link sent to player@example.com');
  });

  it('says when the link could not be sent, and can be tried again', async () => {
    onSendReset.mockResolvedValue(false);
    open();
    await act(async () => fireEvent.click(resetButton()));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't send the link.");
    await act(async () => fireEvent.click(resetButton()));
    expect(onSendReset).toHaveBeenCalledTimes(2);
  });
});

it('closes on Cancel without sending', () => {
  open();
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
