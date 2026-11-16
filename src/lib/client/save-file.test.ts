import { saveFile } from '@/lib/client/save-file';

it('hands the browser the file under its name, then lets go of it', () => {
  jest.useFakeTimers();
  const createObjectURL = jest.fn(() => 'blob:copy');
  const revokeObjectURL = jest.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  const blob = new Blob(['Name\r\nHades\r\n'], { type: 'text/csv' });
  saveFile(blob, 'mybacklog-games-2026-11-16.csv');

  expect(createObjectURL).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledTimes(1);
  // The link that was pressed.
  const clicked = click.mock.contexts[0] as HTMLAnchorElement;
  expect(clicked.download).toBe('mybacklog-games-2026-11-16.csv');
  expect(clicked.getAttribute('href')).toBe('blob:copy');
  // The link was only there to be pressed.
  expect(document.querySelector('a[download]')).not.toBeInTheDocument();

  // Not let go of at once: the save has to have started.
  expect(revokeObjectURL).not.toHaveBeenCalled();
  jest.advanceTimersByTime(60_000);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:copy');

  click.mockRestore();
  jest.useRealTimers();
});
