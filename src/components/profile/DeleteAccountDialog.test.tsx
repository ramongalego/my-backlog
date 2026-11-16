import { act, fireEvent, render, screen } from '@testing-library/react';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import type { AccountResult } from '@/lib/client/account';

const onDelete = jest.fn<Promise<AccountResult>, [string]>();
const onClose = jest.fn();

const open = () => render(<DeleteAccountDialog onDelete={onDelete} onClose={onClose} />);
const password = () => screen.getByLabelText('Your password, to confirm');
const submit = () => screen.getByRole('button', { name: /Delete account|Deleting/ });

beforeEach(() => {
  jest.clearAllMocks();
  onDelete.mockResolvedValue({ ok: true });
});

it('says what goes and that it can’t be undone', () => {
  open();
  expect(screen.getByRole('dialog', { name: 'Delete account' })).toHaveTextContent(
    "This deletes your account and everything in it: your library, diary, queue, favorites and profile picture. It can't be undone.",
  );
});

it('asks for the password before deleting anything', async () => {
  open();
  await act(async () => fireEvent.click(submit()));
  expect(screen.getByText('Enter your password')).toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();
});

it('deletes with the password, once, and stays saying so while the page leaves', async () => {
  let done!: (result: AccountResult) => void;
  onDelete.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  fireEvent.change(password(), { target: { value: 'My-pass1' } });
  await act(async () => {
    fireEvent.click(submit());
    fireEvent.click(submit());
    fireEvent.click(submit());
  });
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onDelete).toHaveBeenCalledWith('My-pass1');

  await act(async () => done({ ok: true }));
  expect(submit()).toHaveTextContent('Deleting…');
  // Nothing closes it now: the account is gone and the page is leaving.
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
});

it('says when the password is wrong, and can be tried again', async () => {
  onDelete.mockResolvedValueOnce({
    ok: false,
    error: "That isn't your password",
    field: 'password',
  });
  open();
  fireEvent.change(password(), { target: { value: 'wrong' } });
  await act(async () => fireEvent.click(submit()));
  expect(password()).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText("That isn't your password")).toBeInTheDocument();

  fireEvent.change(password(), { target: { value: 'My-pass1' } });
  await act(async () => fireEvent.click(submit()));
  expect(onDelete).toHaveBeenCalledTimes(2);
});

it('closes on Cancel without deleting', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onDelete).not.toHaveBeenCalled();
});
