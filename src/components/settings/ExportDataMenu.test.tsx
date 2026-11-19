import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { ExportDataMenu } from '@/components/settings/ExportDataMenu';
import type { ApiResult } from '@/lib/client/request';

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

const onDownload = jest.fn<Promise<ApiResult>, [string]>();
const open = () => {
  render(
    <>
      <ExportDataMenu onDownload={onDownload} />
      <button>Elsewhere</button>
    </>,
  );
  fireEvent.click(trigger());
};
const trigger = () => screen.getByRole('button', { name: 'Export data' });
const item = (name: string) => screen.getByRole('menuitem', { name });

beforeEach(() => {
  jest.clearAllMocks();
  onDownload.mockResolvedValue({ ok: true });
});

it('opens a menu of the two files, on the first of them', () => {
  render(<ExportDataMenu onDownload={onDownload} />);
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();

  fireEvent.click(trigger());
  expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menu', { name: 'Export data' })).toBeInTheDocument();
  expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
    'Games (CSV)',
    'Everything (JSON)',
  ]);
  expect(item('Games (CSV)')).toHaveFocus();
});

it('downloads the file chosen, closes, and goes back to the button', async () => {
  open();
  await act(async () => fireEvent.click(item('Everything (JSON)')));
  expect(onDownload).toHaveBeenCalledWith('json');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger()).toHaveFocus();
});

it('asks for the file once, however many times it is pressed', async () => {
  let done!: (result: ApiResult) => void;
  onDownload.mockReturnValue(new Promise((resolve) => (done = resolve)));
  open();
  const csv = item('Games (CSV)');
  await act(async () => {
    fireEvent.click(csv);
    fireEvent.click(csv);
    fireEvent.click(csv);
  });
  expect(onDownload).toHaveBeenCalledTimes(1);

  // Busy, not disabled: it has the focus. And it won't open again until the file is here.
  expect(trigger()).toHaveAttribute('aria-busy', 'true');
  expect(trigger()).toHaveAttribute('aria-disabled', 'true');
  expect(trigger()).toBeEnabled();
  fireEvent.click(trigger());
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();

  await act(async () => done({ ok: true }));
  expect(trigger()).not.toHaveAttribute('aria-busy');
  fireEvent.click(trigger());
  expect(screen.getByRole('menu')).toBeInTheDocument();
});

it('says why when the file could not be fetched, and can be tried again', async () => {
  onDownload.mockResolvedValue({ ok: false, error: "Couldn't prepare your data." });
  open();
  await act(async () => fireEvent.click(item('Games (CSV)')));
  expect(toast.error).toHaveBeenCalledWith("Couldn't prepare your data.", expect.anything());

  fireEvent.click(trigger());
  await act(async () => fireEvent.click(item('Games (CSV)')));
  expect(onDownload).toHaveBeenCalledTimes(2);
});

it('moves through the choices with the arrow keys, round the ends', () => {
  open();
  const menu = screen.getByRole('menu');
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(item('Everything (JSON)')).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(item('Games (CSV)')).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(item('Everything (JSON)')).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'Home' });
  expect(item('Games (CSV)')).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(item('Everything (JSON)')).toHaveFocus();
});

it('closes on Escape, back on the button, and on a press anywhere else', () => {
  open();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger()).toHaveFocus();
  expect(onDownload).not.toHaveBeenCalled();

  fireEvent.click(trigger());
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Elsewhere' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
