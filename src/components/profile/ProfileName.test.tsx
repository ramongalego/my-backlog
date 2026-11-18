import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProfileName } from '@/components/profile/ProfileName';

type Result = { ok: true } | { ok: false; error: string };
const onSave = jest.fn<Promise<Result>, [string | null]>();

const open = (chosen: string | null = null, name = chosen ?? 'Ankrath') => {
  render(
    <ProfileName
      name={name}
      fallback="Ankrath"
      chosen={chosen}
      onSave={onSave}
      under={<p>Member since January 2026</p>}
    />,
  );
};
const pencil = () => screen.getByRole('button', { name: 'Change name' });
const field = () => screen.getByRole('textbox', { name: 'Name' });
const type = (value: string) => fireEvent.change(field(), { target: { value } });

beforeEach(() => {
  jest.clearAllMocks();
  onSave.mockResolvedValue({ ok: true });
});

it('shows the name as the page title, with a pencil beside it', () => {
  open();
  expect(screen.getByRole('heading', { level: 1, name: 'Ankrath' })).toBeInTheDocument();
  expect(pencil()).toBeInTheDocument();
  expect(screen.getByText('Member since January 2026')).toBeInTheDocument();
});

it("turns into a field holding the chosen name, with the account's as its placeholder", () => {
  open('Ramon');
  fireEvent.click(pencil());
  expect(field()).toHaveValue('Ramon');
  expect(field()).toHaveAttribute('placeholder', 'Ankrath');
  expect(field()).toHaveFocus();
  expect(screen.getByText('Leave it empty to use Ankrath')).toBeInTheDocument();
  expect(screen.queryByText('Member since January 2026')).not.toBeInTheDocument();
});

it('starts empty when the name is the account’s own', () => {
  open();
  fireEvent.click(pencil());
  expect(field()).toHaveValue('');
});

it('saves with Enter, tidied, and goes back to the name with focus on the pencil', async () => {
  open();
  fireEvent.click(pencil());
  type('  Big   Boss  ');
  await act(async () => fireEvent.submit(field()));
  expect(onSave).toHaveBeenCalledWith('Big Boss');
  expect(pencil()).toHaveFocus();
});

it('saves an empty name as none, going back to the account’s', async () => {
  open('Ramon');
  fireEvent.click(pencil());
  type('   ');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save name' })));
  expect(onSave).toHaveBeenCalledWith(null);
});

it('sends nothing when the name is the same', async () => {
  open('Ramon');
  fireEvent.click(pencil());
  await act(async () => fireEvent.submit(field()));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('saves once, however many times it is pressed', async () => {
  let done!: (result: Result) => void;
  onSave.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  fireEvent.click(pencil());
  type('Snake');
  const save = screen.getByRole('button', { name: 'Save name' });
  await act(async () => {
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.submit(field());
  });
  expect(onSave).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true }));
});

it('puts the name back with Escape or the X, saving nothing', () => {
  open();
  fireEvent.click(pencil());
  type('Snake');
  fireEvent.keyDown(field(), { key: 'Escape' });
  expect(screen.getByRole('heading', { name: 'Ankrath' })).toBeInTheDocument();
  expect(pencil()).toHaveFocus();

  fireEvent.click(pencil());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});

it('stays open and says why when it could not be saved', async () => {
  onSave.mockResolvedValue({ ok: false, error: "Couldn't save your name. Please try again." });
  open();
  fireEvent.click(pencil());
  type('Snake');
  await act(async () => fireEvent.submit(field()));
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save your name. Please try again.");
  expect(field()).toHaveAttribute('aria-invalid', 'true');
});

it('refuses a name that is too long, without sending it', async () => {
  open();
  fireEvent.click(pencil());
  type('x'.repeat(41));
  await act(async () => fireEvent.submit(field()));
  expect(screen.getByRole('alert')).toHaveTextContent('Keep it to 40 characters');
  expect(onSave).not.toHaveBeenCalled();
});

it('ignores Escape while it is saving: the name would still change behind a field that looked canceled', async () => {
  let done!: (result: Result) => void;
  onSave.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  fireEvent.click(pencil());
  type('Snake');
  await act(async () => fireEvent.submit(field()));

  fireEvent.keyDown(field(), { key: 'Escape' });
  expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();

  await act(async () => done({ ok: true }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('wraps a long name on a phone and cuts it beside the figures on a desktop', () => {
  open();
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading).toHaveClass('lg:truncate', '[overflow-wrap:anywhere]');
  expect(heading).not.toHaveClass('truncate');
});

it('keeps the page its heading while the name is a field', () => {
  open();
  fireEvent.click(pencil());
  expect(screen.getByRole('heading', { level: 1, name: 'Ankrath' })).toHaveClass('sr-only');
});
