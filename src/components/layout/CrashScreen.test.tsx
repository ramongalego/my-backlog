import { fireEvent, render, screen } from '@testing-library/react';
import { CrashScreen } from '@/components/layout/CrashScreen';

it('says the page failed and offers to try again', () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const retry = jest.fn();
  const error = new Error('boom');
  render(<CrashScreen error={error} retry={retry} />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledWith(error);
  jest.restoreAllMocks();
});
