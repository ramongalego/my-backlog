import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { ChangeNameDialog } from '@/components/settings/ChangeNameDialog';
import type { ApiResult } from '@/lib/client/request';

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

type Result = ApiResult<{ name: string | null }>;

const onSubmit = jest.fn<Promise<Result>, [string | null]>();
const onClose = jest.fn();

const open = (chosen: string | null = null) =>
  render(
    <ChangeNameDialog
      chosen={chosen}
      accountName="Ankrath"
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
const field = () => screen.getByLabelText('Display name');
const type = (name: string) => fireEvent.change(field(), { target: { value: name } });
const save = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  jest.clearAllMocks();
  onSubmit.mockImplementation(async (name) => ({ ok: true, name }));
});

it('starts from the name they chose, or empty over the name the account has', () => {
  const { unmount } = open('Big Boss');
  expect(screen.getByRole('dialog', { name: 'Change display name' })).toBeInTheDocument();
  expect(field()).toHaveValue('Big Boss');
  unmount();

  open();
  expect(field()).toHaveValue('');
  expect(field()).toHaveAttribute('placeholder', 'Ankrath');
  expect(field()).toHaveAccessibleDescription('Leave it empty to use Ankrath');
});

it('saves the new name, tidied, says so, and closes', async () => {
  open();
  type('  Big   Boss ');
  await act(async () => fireEvent.click(save()));

  expect(onSubmit).toHaveBeenCalledWith('Big Boss');
  expect(toast.success).toHaveBeenCalledWith('Your display name is now Big Boss');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("clears a chosen name when left empty, back to the account's", async () => {
  open('Big Boss');
  type('   ');
  await act(async () => fireEvent.click(save()));

  expect(onSubmit).toHaveBeenCalledWith(null);
  expect(toast.success).toHaveBeenCalledWith('Your display name is Ankrath again');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('closes without saving when nothing changed', async () => {
  const { unmount } = open('Big Boss');
  await act(async () => fireEvent.click(save()));
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();

  open();
  await act(async () => fireEvent.click(save()));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

it('says a name is too long under the field, without sending it', async () => {
  open();
  type('x'.repeat(41));
  await act(async () => fireEvent.click(save()));

  expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 40 characters');
  expect(onSubmit).not.toHaveBeenCalled();
  // Gone as soon as the name is typed again.
  type('x'.repeat(40));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('says why a name was refused under the field, and stays open to try another', async () => {
  onSubmit.mockResolvedValueOnce({ ok: false, error: "That name isn't available" });
  open();
  type('Admin');
  await act(async () => fireEvent.click(save()));

  expect(screen.getByRole('alert')).toHaveTextContent("That name isn't available");
  expect(field()).toHaveValue('Admin');
  expect(onClose).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();

  type('Big Boss');
  await act(async () => fireEvent.click(save()));
  expect(onSubmit).toHaveBeenLastCalledWith('Big Boss');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('sends once, however many times it is pressed', async () => {
  let done!: (result: Result) => void;
  onSubmit.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  type('Big Boss');
  await act(async () => {
    fireEvent.click(save());
    fireEvent.click(save());
    fireEvent.click(save());
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  await act(async () => done({ ok: true, name: 'Big Boss' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('closes from Cancel, saving nothing', () => {
  open('Big Boss');
  type('Someone Else');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
});
