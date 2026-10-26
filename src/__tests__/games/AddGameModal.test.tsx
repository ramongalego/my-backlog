import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddGameModal } from '@/components/games/AddGameModal';
import { defaultConsole, orderConsoles } from '@/components/games/ConsolePicker';
import { addManualGame, getGameDetails, searchGames } from '@/lib/games/manual';
import { loadCurrentlyPlaying, loadManualGames } from '@/lib/data/loaders';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/data/loaders', () => ({
  loadManualGames: jest.fn(),
  loadCurrentlyPlaying: jest.fn(),
}));
jest.mock('@/lib/games/manual', () => ({
  ...jest.requireActual('@/lib/games/manual'),
  searchGames: jest.fn(),
  getGameDetails: jest.fn(),
  addManualGame: jest.fn(),
}));

const fortunesWeave = {
  igdbId: 1,
  name: "Fire Emblem: Fortune's Weave",
  year: 2026,
  cover: null,
  platforms: ['Nintendo Switch 2'],
};
const linkToThePast = {
  igdbId: 2,
  name: 'The Legend of Zelda: A Link to the Past',
  year: 1991,
  cover: null,
  platforms: [
    'Satellaview',
    'Super Nintendo Entertainment System',
    'Wii U',
    'New Nintendo 3DS',
    'Wii',
  ],
};

function setup({ playing = null as { name: string } | null, owned = [] as unknown[] } = {}) {
  jest.mocked(loadManualGames).mockResolvedValue(owned as never);
  jest.mocked(loadCurrentlyPlaying).mockResolvedValue(playing as never);
  const onAdded = jest.fn();
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddGameModal userId="u" onAdded={onAdded} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onAdded, onClose };
}

async function search(text: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Search for a game' }), {
    target: { value: text },
  });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.mocked(searchGames).mockResolvedValue([fortunesWeave, linkToThePast]);
  jest.mocked(getGameDetails).mockReturnValue(new Promise(() => {}));
  jest.mocked(addManualGame).mockResolvedValue({ id: 9, name: fortunesWeave.name });
});
afterEach(() => jest.useRealTimers());

it('logs a game you already finished, with its date and rating', async () => {
  const { onAdded, onClose } = setup();
  await search('fire emblem');
  expect(searchGames).toHaveBeenCalledTimes(1);

  // Arrow keys move through the results; Enter picks.
  const input = screen.getByRole('combobox');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  fireEvent.keyDown(input, { key: 'Enter' });

  // The same detail dialog every game uses, with the game's only console picked.
  expect(screen.getByRole('heading', { name: "Fire Emblem: Fortune's Weave" })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Switch 2' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Finished' }));
  fireEvent.change(screen.getByLabelText('Your rating (0–10)'), { target: { value: '9' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));
  });

  expect(addManualGame).toHaveBeenCalledWith(
    expect.objectContaining({ igdbId: 1, platform: 'Switch 2', status: 'finished', rating: 9 }),
  );
  expect(jest.mocked(addManualGame).mock.calls[0][0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(onAdded).toHaveBeenCalledWith(fortunesWeave.name, 'finished', undefined);
  expect(onClose).toHaveBeenCalled();
});

it("makes you pick the console when it can't safely guess", async () => {
  setup();
  await search('link to the past');
  fireEvent.click(screen.getByRole('option', { name: /A Link to the Past/ }));

  // Known consoles newest first, obscure ones behind "More"; nothing picked yet.
  const chips = screen.getAllByRole('button', { name: /^(Wii U|New 3DS|Wii|SNES|Satellaview)$/ });
  expect(chips.map((c) => c.textContent)).toEqual(['Wii U', 'New 3DS', 'Wii', 'SNES']);
  expect(screen.getByRole('button', { name: '1 more' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add to library' })).toBeDisabled();
  expect(screen.getByText('Pick the console you play it on')).toBeInTheDocument();
});

it('marks games already in your library and suggests your consoles first', async () => {
  setup({ owned: [{ id: 5, igdb_id: 2, platform: 'Wii U', created_at: '2026-10-01' }] });
  await search('zelda');
  expect(screen.getByText('In your library on Wii U')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('option', { name: /A Link to the Past/ }));
  expect(screen.getByRole('button', { name: 'Wii U' })).toHaveAttribute('aria-pressed', 'true');
});

it('says when starting it moves the current game back to the backlog', async () => {
  setup({ playing: { name: 'Celeste' } });
  await search('fire emblem');
  fireEvent.click(screen.getByRole('option', { name: /Fortune's Weave/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Playing' }));
  expect(screen.getByText('Celeste goes back to your backlog.')).toBeInTheDocument();
});

it("keeps the form and shows the server's message when the game can't be added", async () => {
  jest
    .mocked(addManualGame)
    .mockRejectedValue(new Error("It's already in your library on Switch 2"));
  const { onClose } = setup();
  await search('fire emblem');
  fireEvent.click(screen.getByRole('option', { name: /Fortune's Weave/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add to library' }));
  });
  expect(screen.getByRole('alert')).toHaveTextContent("It's already in your library on Switch 2");
  expect(onClose).not.toHaveBeenCalled();
});

it('goes back to the same search from "Not this game?"', async () => {
  setup();
  await search('fire emblem');
  fireEvent.click(screen.getByRole('option', { name: /Fortune's Weave/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Not this game?' }));
  expect(screen.getByRole('combobox')).toHaveValue('fire emblem');
  expect(screen.getAllByRole('option')).toHaveLength(2);
});

it('fetches the highlighted game early and holds its header until the art is known', async () => {
  let resolve: (details: unknown) => void = () => {};
  jest.mocked(getGameDetails).mockReturnValue(new Promise((r) => (resolve = r)) as never);
  setup();
  await search('fire emblem');
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(getGameDetails).toHaveBeenCalledWith(1);

  fireEvent.click(screen.getByRole('option', { name: /Fortune's Weave/ }));
  // A placeholder, not the box art that the wide art would replace.
  expect(screen.getByTestId('header-loading')).toBeInTheDocument();
  expect(getGameDetails).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolve({ platforms: ['Nintendo Switch 2'], header_image: 'https://example.com/wide.jpg' });
  });
  // React Query hands results over on a timer.
  await act(async () => {
    jest.advanceTimersByTime(10);
  });
  expect(screen.queryByTestId('header-loading')).not.toBeInTheDocument();
});

it("doesn't search for a single character", async () => {
  setup();
  await search('m');
  expect(searchGames).not.toHaveBeenCalled();
});

describe('console order', () => {
  it('puts your consoles first, then known consoles newest first, then obscure ones', () => {
    expect(orderConsoles(['Satellaview', 'SNES', 'Switch', 'PS5'], [])).toEqual([
      'PS5',
      'Switch',
      'SNES',
      'Satellaview',
    ]);
    expect(orderConsoles(['PS5', 'Switch'], ['Switch'])).toEqual(['Switch', 'PS5']);
  });

  it('only picks one for you when it is a safe guess', () => {
    expect(defaultConsole(['Switch 2'], [])).toBe('Switch 2');
    expect(defaultConsole(['PS5', 'Switch'], [])).toBe('');
    expect(defaultConsole(['Switch', 'PS5'], ['Switch'])).toBe('Switch');
  });
});
