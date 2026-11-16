import { act, fireEvent, render, screen } from '@testing-library/react';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';
import type { AccountResult, DeleteProof } from '@/lib/client/account';

const onDelete = jest.fn<Promise<AccountResult>, [DeleteProof]>();
const onClose = jest.fn();
const onDownloadData = jest.fn();

const open = (hasPassword = true) =>
  render(
    <DeleteAccountDialog
      hasPassword={hasPassword}
      onDelete={onDelete}
      onDownloadData={onDownloadData}
      onClose={onClose}
    />,
  );
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

it('starts on Cancel, not in the field, with or without a password to ask for', async () => {
  const frame = () =>
    act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const { unmount } = open();
  // The dialog moves focus in on the next frame.
  await frame();
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  unmount();

  open(false);
  await frame();
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
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
  expect(onDelete).toHaveBeenCalledWith({ password: 'My-pass1' });

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

it('offers a copy of the data first, without deleting anything', async () => {
  onDownloadData.mockResolvedValue({ ok: true });
  open();
  expect(screen.getByText('Want a copy first?')).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Everything (JSON)' })));
  expect(onDownloadData).toHaveBeenCalledWith('json');
  expect(onDelete).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Delete account' })).toBeInTheDocument();
});

it('makes no offer of a copy when there is nothing to copy', () => {
  render(<DeleteAccountDialog hasPassword onDelete={onDelete} onClose={onClose} />);
  expect(screen.queryByText('Want a copy first?')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Your password, to confirm')).toBeInTheDocument();
});

describe('an account with no password (made with Google or Discord)', () => {
  const word = () => screen.getByLabelText('Type "delete" to confirm');

  it('asks for the word "delete", shown as typed, where the password would be', () => {
    open(false);
    expect(screen.queryByLabelText('Your password, to confirm')).not.toBeInTheDocument();
    expect(word()).toHaveAttribute('type', 'text');
    expect(word()).toHaveAttribute('autocomplete', 'off');
  });

  it('deletes nothing until the word is typed', async () => {
    open(false);
    await act(async () => fireEvent.click(submit()));
    fireEvent.change(word(), { target: { value: 'delet' } });
    await act(async () => fireEvent.click(submit()));
    expect(word()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter the word "delete"')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes with the word, however it is capitalized, once', async () => {
    onDelete.mockReturnValue(new Promise(() => {}));
    open(false);
    fireEvent.change(word(), { target: { value: 'Delete' } });
    await act(async () => {
      fireEvent.click(submit());
      fireEvent.click(submit());
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith({ confirm: 'Delete' });
  });

  it('says so above the field when the server refuses it for another reason', async () => {
    onDelete.mockResolvedValueOnce({
      ok: false,
      error: 'Your account has a password now. Reload the page and try again.',
    });
    open(false);
    fireEvent.change(word(), { target: { value: 'delete' } });
    await act(async () => fireEvent.click(submit()));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your account has a password now. Reload the page and try again.',
    );
  });
});
