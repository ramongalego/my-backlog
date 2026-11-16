import { act, fireEvent, render, screen } from '@testing-library/react';
import { PickNextHint } from '@/components/home/PickNextHint';
import { useConnectSteam } from '@/hooks/useConnectSteam';
import { connectSteam } from '@/lib/client/steam-connect';

jest.mock('@/lib/client/steam-connect', () => ({ connectSteam: jest.fn() }));

function Hint({ backlogCount }: { backlogCount: number }) {
  const { connect } = useConnectSteam();
  return (
    <PickNextHint
      backlogCount={backlogCount}
      isSteamConnected={false}
      onAddGame={jest.fn()}
      onConnectSteam={connect}
    />
  );
}

afterEach(() => {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  });
  jest.clearAllMocks();
});

it.each([
  [3, 'connect Steam'],
  [40, 'Connect Steam'],
])('shows the link in its sentence as busy once pressed (%i games)', (backlogCount, name) => {
  render(<Hint backlogCount={backlogCount} />);
  const link = screen.getByRole('button', { name });
  expect(link.querySelector('.animate-spin')).not.toBeInTheDocument();

  fireEvent.click(link);
  fireEvent.click(link);
  expect(connectSteam).toHaveBeenCalledTimes(1);
  expect(link).toHaveAttribute('aria-busy', 'true');
  expect(link.querySelector('.animate-spin')).toBeInTheDocument();
  // The words stay as they were: the spinner follows them.
  expect(link).toHaveTextContent(name);
  expect(link).toBeEnabled();
});
