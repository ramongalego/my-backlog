import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ChangePasswordDialog } from '@/components/settings/ChangePasswordDialog';
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
/** Waits out the dialog's own focus move (a frame later), so it can't overtake a test's. */
const openAndSettle = async () => {
  open();
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
};
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

it('keeps focus in the form when the reset link is sent, on the line that says so', async () => {
  await openAndSettle();
  const button = screen.getByRole('button', { name: 'Email me a reset link' });
  button.focus();
  await act(async () => fireEvent.click(button));
  expect(screen.getByRole('status')).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Reset link sent to player@example.com');
});

it('marks the reset link as busy while it sends, without disabling what holds the focus', async () => {
  let done!: (sent: boolean) => void;
  onSendReset.mockReturnValue(new Promise((resolve) => (done = resolve)));
  await openAndSettle();
  const button = screen.getByRole('button', { name: 'Email me a reset link' });
  button.focus();
  await act(async () => fireEvent.click(button));
  const sending = screen.getByRole('button', { name: 'Sending…' });
  expect(sending).toHaveAttribute('aria-disabled', 'true');
  expect(sending).toBeEnabled();
  expect(sending).toHaveFocus();
  await act(async () => done(true));
});

it('starts on its title, not in a field, with the first field one Tab on', async () => {
  open();
  // The dialog moves focus in on the next frame.
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(screen.getByRole('heading', { name: 'Change password' })).toHaveFocus();

  await userEvent.tab();
  expect(screen.getByLabelText('Current password')).toHaveFocus();
});
