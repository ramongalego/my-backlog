import { fireEvent, render, screen } from '@testing-library/react';
import { BuildBacklog } from '@/components/home/BuildBacklog';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src }: { src: string }) => <img alt="" src={src} />,
}));

const props = {
  covers: [] as string[],
  count: 0,
  historyCount: 0,
  steamEmpty: false,
  isSteamConnected: false,
  onAddGame: jest.fn(),
  onConnectSteam: jest.fn(),
};

const slots = () => screen.getByRole('progressbar', { hidden: true }).children;

it('fills its slots with the games added, the first one in the large slot', () => {
  // Recently Added lists them newest first.
  render(<BuildBacklog {...props} count={2} covers={['second.jpg', 'first.jpg']} />);
  const [large, next, empty] = Array.from(slots());
  expect(large.querySelector('img')).toHaveAttribute('src', 'first.jpg');
  expect(next.querySelector('img')).toHaveAttribute('src', 'second.jpg');
  expect(empty.tagName).toBe('BUTTON');
  expect(screen.getByText('2 of 3 games')).toBeInTheDocument();
});

it('fills a slot without art when Home has none for a game', () => {
  render(<BuildBacklog {...props} count={1} covers={[]} />);
  const [large] = Array.from(slots());
  expect(large.tagName).toBe('DIV');
  expect(large.querySelector('img')).toBeNull();
});

it('opens Add game from an empty slot', () => {
  render(<BuildBacklog {...props} />);
  fireEvent.click(slots()[0]);
  expect(props.onAddGame).toHaveBeenCalled();
});

it('offers Steam only while it is not connected', () => {
  const { rerender } = render(<BuildBacklog {...props} />);
  expect(screen.getByRole('button', { name: 'Connect Steam' })).toBeInTheDocument();
  rerender(<BuildBacklog {...props} isSteamConnected />);
  expect(screen.queryByRole('button', { name: 'Connect Steam' })).not.toBeInTheDocument();
});

it('says why a connected Steam account brought no games, with a link to the setting', () => {
  render(<BuildBacklog {...props} steamEmpty isSteamConnected />);

  expect(screen.getByText(/Steam is connected, but it sent back no games/)).toHaveTextContent(
    /game details are private.*Game details.*Public.*Refresh library in your account menu/,
  );
  const link = screen.getByRole('link', { name: "Steam's privacy settings" });
  expect(link).toHaveAttribute('href', 'https://steamcommunity.com/my/edit/settings');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

it('keeps the usual line when Steam has games, or is not connected', () => {
  render(<BuildBacklog {...props} />);
  expect(screen.queryByText(/sent back no games/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
