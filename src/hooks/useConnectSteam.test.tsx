import { act, fireEvent, render, screen } from '@testing-library/react';
import { useConnectSteam } from '@/hooks/useConnectSteam';
import { connectSteam } from '@/lib/client/steam-connect';
import { ConnectSteamButton } from '@/components/ui/ConnectSteamButton';

// Leaving for Steam's sign-in page: here, just counted.
jest.mock('@/lib/client/steam-connect', () => ({ connectSteam: jest.fn() }));

/** A page with two ways to connect Steam, as Home has (its button and the header's menu). */
function Page() {
  const { connecting, connect } = useConnectSteam();
  return (
    <>
      <ConnectSteamButton onClick={connect} />
      <ConnectSteamButton onClick={connect}>Connect</ConnectSteamButton>
      <p>{connecting ? 'connecting' : 'idle'}</p>
    </>
  );
}
const button = (name: string) => screen.getByRole('button', { name });
/** The page shown again from the browser's back-forward cache. */
const comeBack = () =>
  act(() => {
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  // Each test starts with nothing connecting.
  comeBack();
  jest.useRealTimers();
});

it('leaves for Steam once, however many times it is pressed, on any of them', () => {
  render(<Page />);
  act(() => {
    fireEvent.click(button('Connect Steam'));
    fireEvent.click(button('Connect Steam'));
    fireEvent.click(button('Connect'));
  });
  expect(connectSteam).toHaveBeenCalledTimes(1);
});

it('marks every Connect Steam control busy until Steam takes over, without disabling any', () => {
  render(<Page />);
  const pressed = button('Connect Steam');
  expect(pressed).not.toHaveAttribute('aria-busy');
  expect(pressed.querySelector('.animate-spin')).not.toBeInTheDocument();

  pressed.focus();
  fireEvent.click(pressed);
  for (const each of [pressed, button('Connect')]) {
    expect(each).toHaveAttribute('aria-busy', 'true');
    expect(each).toHaveAttribute('aria-disabled', 'true');
    // The Steam mark gives way to a spinner; the label stays.
    expect(each.querySelectorAll('svg')).toHaveLength(1);
    expect(each.querySelector('.animate-spin')).toBeInTheDocument();
    expect(each).toBeEnabled();
  }
  expect(pressed).toHaveTextContent('Connect Steam');
  expect(pressed).toHaveFocus();
  expect(screen.getByText('connecting')).toBeInTheDocument();
});

it("isn't left busy when the player comes back from Steam with the Back button", () => {
  render(<Page />);
  fireEvent.click(button('Connect Steam'));
  expect(button('Connect Steam')).toHaveAttribute('aria-busy', 'true');

  comeBack();
  expect(button('Connect Steam')).not.toHaveAttribute('aria-busy');
  // And it can be pressed again.
  fireEvent.click(button('Connect Steam'));
  expect(connectSteam).toHaveBeenCalledTimes(2);
});

it("ignores the page being shown the usual way: that's not a return", () => {
  render(<Page />);
  fireEvent.click(button('Connect Steam'));
  act(() => {
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
  });
  expect(button('Connect Steam')).toHaveAttribute('aria-busy', 'true');
});

it("can be pressed again if Steam's page never comes", () => {
  render(<Page />);
  fireEvent.click(button('Connect Steam'));
  act(() => jest.advanceTimersByTime(19_000));
  expect(button('Connect Steam')).toHaveAttribute('aria-busy', 'true');
  act(() => jest.advanceTimersByTime(1_000));
  expect(button('Connect Steam')).not.toHaveAttribute('aria-busy');
});
