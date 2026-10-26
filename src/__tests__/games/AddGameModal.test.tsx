import { act, fireEvent, render, screen } from '@testing-library/react';
import { AddGameModal } from '@/components/games/AddGameModal';
import { addManualGame, searchGames } from '@/lib/games/manual';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
jest.mock('@/lib/games/manual', () => ({
  ...jest.requireActual('@/lib/games/manual'),
  searchGames: jest.fn(),
  addManualGame: jest.fn(),
}));

const result = {
  igdbId: 338067,
  name: 'Mario Kart World',
  year: 2025,
  cover: null,
  platforms: ['Nintendo Switch 2'],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.mocked(searchGames).mockResolvedValue([result]);
  jest.mocked(addManualGame).mockResolvedValue({ id: 1, name: 'Mario Kart World' });
});
afterEach(() => jest.useRealTimers());

async function search(text: string) {
  fireEvent.change(screen.getByLabelText('Search for a game'), { target: { value: text } });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
}

it('searches after a pause, then adds the chosen game on its console', async () => {
  const onAdded = jest.fn();
  const onClose = jest.fn();
  render(<AddGameModal isOpen onClose={onClose} onAdded={onAdded} hasPlayingGame={false} />);

  await search('mario kart');
  expect(searchGames).toHaveBeenCalledTimes(1);
  expect(jest.mocked(searchGames).mock.calls[0][0]).toBe('mario kart');

  fireEvent.click(screen.getByRole('button', { name: /Mario Kart World/ }));
  // The console's short name, picked by default.
  expect(screen.getByRole('button', { name: 'Switch 2' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Queue' }));
  fireEvent.change(screen.getByLabelText(/Hours played/), { target: { value: '3.5' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add game' }));
  });

  expect(addManualGame).toHaveBeenCalledWith({
    igdbId: 338067,
    platform: 'Switch 2',
    status: 'queue',
    hoursPlayed: 3.5,
  });
  expect(onAdded).toHaveBeenCalledWith('Mario Kart World');
  expect(onClose).toHaveBeenCalled();
});

it("doesn't search for a single character", async () => {
  render(<AddGameModal isOpen onClose={() => {}} onAdded={() => {}} hasPlayingGame={false} />);
  await search('m');
  expect(searchGames).not.toHaveBeenCalled();
});

it("shows the server's message when the game can't be added", async () => {
  jest
    .mocked(addManualGame)
    .mockRejectedValue(new Error("It's already in your library on Switch 2"));
  render(<AddGameModal isOpen onClose={() => {}} onAdded={() => {}} hasPlayingGame={false} />);
  await search('mario kart');
  fireEvent.click(screen.getByRole('button', { name: /Mario Kart World/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add game' }));
  });
  expect(screen.getByRole('alert')).toHaveTextContent("It's already in your library on Switch 2");
});

it("doesn't offer Playing while another game is being played", async () => {
  render(<AddGameModal isOpen onClose={() => {}} onAdded={() => {}} hasPlayingGame />);
  await search('mario kart');
  fireEvent.click(screen.getByRole('button', { name: /Mario Kart World/ }));
  expect(screen.queryByRole('button', { name: 'Playing' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Backlog' })).toBeInTheDocument();
});
