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

describe('a small backlog that is only picked from at random (AI features off)', () => {
  const hint = (isSteamConnected: boolean) =>
    render(
      <PickNextHint
        backlogCount={6}
        isSteamConnected={isSteamConnected}
        onAddGame={jest.fn()}
        onConnectSteam={jest.fn()}
        randomOnly
      />,
    ).container;

  it('asks for more games as more to pick from, not as better picks', () => {
    const container = hint(false);
    expect(container).toHaveTextContent(
      /^Add a few more games to pick from, or connect Steam to bring in your whole library$/,
    );
    expect(container).not.toHaveTextContent('Picks get better');
    expect(screen.getByRole('button', { name: 'Add a few more' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'connect Steam' })).toBeInTheDocument();
  });

  it('leaves Steam out once it is connected', () => {
    expect(hint(true)).toHaveTextContent(/^Add a few more games to pick from$/);
  });
});
