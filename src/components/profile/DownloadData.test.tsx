import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { DownloadData } from '@/components/profile/DownloadData';
import type { ApiResult } from '@/lib/client/request';

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));

const onDownload = jest.fn<Promise<ApiResult>, [string]>();
const draw = () => render(<DownloadData onDownload={onDownload}>Want a copy first?</DownloadData>);
const button = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  onDownload.mockResolvedValue({ ok: true });
});

it('offers the two files beside its line, as one named group', () => {
  draw();
  expect(screen.getByText('Want a copy first?')).toBeInTheDocument();
  const group = screen.getByRole('group', { name: 'Download a copy of your data' });
  expect([...group.querySelectorAll('button')].map((el) => el.textContent)).toEqual([
    'Games (CSV)',
    'Everything (JSON)',
  ]);
});

it('downloads the file pressed', async () => {
  draw();
  await act(async () => fireEvent.click(button('Games (CSV)')));
  expect(onDownload).toHaveBeenCalledWith('csv');
  await act(async () => fireEvent.click(button('Everything (JSON)')));
  expect(onDownload).toHaveBeenLastCalledWith('json');
});

it('fetches one file at a time, however many times either is pressed', async () => {
  let done!: (result: ApiResult) => void;
  onDownload.mockReturnValue(new Promise((resolve) => (done = resolve)));
  draw();
  const csv = button('Games (CSV)');
  csv.focus();
  await act(async () => {
    fireEvent.click(csv);
    fireEvent.click(csv);
    fireEvent.click(button('Everything (JSON)'));
  });
  expect(onDownload).toHaveBeenCalledTimes(1);

  // Busy, not disabled: the one pressed keeps the focus.
  expect(csv).toHaveAttribute('aria-busy', 'true');
  expect(csv).toBeEnabled();
  expect(csv).toHaveFocus();
  expect(button('Everything (JSON)')).toHaveAttribute('aria-disabled', 'true');

  await act(async () => done({ ok: true }));
  expect(csv).not.toHaveAttribute('aria-busy');
  expect(button('Everything (JSON)')).not.toHaveAttribute('aria-disabled');
});

it('says why when the file could not be fetched', async () => {
  onDownload.mockResolvedValue({ ok: false, error: 'Too many downloads.' });
  draw();
  await act(async () => fireEvent.click(button('Games (CSV)')));
  expect(toast.error).toHaveBeenCalledWith('Too many downloads.', expect.anything());
});
