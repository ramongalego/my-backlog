import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { ChangeUsernameDialog } from '@/components/settings/ChangeUsernameDialog';
import type { ApiResult } from '@/lib/client/request';

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

type Result = ApiResult<{ username: string }, 'username'>;

const onSubmit = jest.fn<Promise<Result>, [string]>();
const onClose = jest.fn();

const open = () =>
  render(<ChangeUsernameDialog username="player4821" onSubmit={onSubmit} onClose={onClose} />);
const field = () => screen.getByLabelText('New username');
const type = (username: string) => fireEvent.change(field(), { target: { value: username } });
const save = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  jest.clearAllMocks();
  onSubmit.mockImplementation(async (username) => ({ ok: true, username }));
});

it('says what a username can hold, under an empty field', () => {
  open();
  expect(screen.getByRole('dialog', { name: 'Change username' })).toBeInTheDocument();
  expect(field()).toHaveValue('');
  expect(field()).toHaveAccessibleDescription('3 to 20 characters: letters, numbers, - and _');
});

it('saves the new username, says so, and closes', async () => {
  open();
  type('mistkai');
  await act(async () => fireEvent.click(save()));

  expect(onSubmit).toHaveBeenCalledWith('mistkai');
  expect(toast.success).toHaveBeenCalledWith('Your username is now mistkai');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('shows capitals lowered as they are typed, as the username will be saved', async () => {
  open();
  type('MistKai');
  expect(field()).toHaveValue('mistkai');
  await act(async () => fireEvent.click(save()));
  expect(onSubmit).toHaveBeenCalledWith('mistkai');
});

it('sends once, however many times it is pressed', async () => {
  let done!: (result: Result) => void;
  onSubmit.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  type('mistkai');
  await act(async () => {
    fireEvent.click(save());
    fireEvent.click(save());
    fireEvent.click(save());
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true, username: 'mistkai' }));
});

it('refuses an empty, malformed or unchanged username without sending', async () => {
  open();
  await act(async () => fireEvent.click(save()));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a username');
  expect(field()).toHaveAttribute('aria-invalid', 'true');

  type('ab');
  // Typing takes away what was said about what was typed before.
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => fireEvent.click(save()));
  expect(screen.getByRole('alert')).toHaveTextContent('Use at least 3 characters');

  type('mist kai');
  await act(async () => fireEvent.click(save()));
  expect(screen.getByRole('alert')).toHaveTextContent('Use only letters, numbers, - and _');

  type('Player4821');
  await act(async () => fireEvent.click(save()));
  expect(screen.getByRole('alert')).toHaveTextContent("That's already your username");
  expect(onSubmit).not.toHaveBeenCalled();
});

it('says under the field that a username is taken, and stays open to try another', async () => {
  onSubmit.mockResolvedValueOnce({
    ok: false,
    error: 'That username is taken',
    field: 'username',
  });
  open();
  type('mistkai');
  await act(async () => fireEvent.click(save()));
  expect(field()).toHaveAttribute('aria-invalid', 'true');
  expect(field()).toHaveAccessibleDescription('That username is taken');
  expect(onClose).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();

  type('mistkai7');
  await act(async () => fireEvent.click(save()));
  expect(onSubmit).toHaveBeenLastCalledWith('mistkai7');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('says a failure that is not about the username above the form', async () => {
  onSubmit.mockResolvedValueOnce({
    ok: false,
    error: "Couldn't save your username. Please try again.",
  });
  open();
  type('mistkai');
  await act(async () => fireEvent.click(save()));
  expect(screen.getByText("Couldn't save your username. Please try again.")).toBeInTheDocument();
  expect(field()).not.toHaveAttribute('aria-invalid');
  expect(onClose).not.toHaveBeenCalled();
});
