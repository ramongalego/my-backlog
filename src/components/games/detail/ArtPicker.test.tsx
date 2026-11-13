import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArtPicker } from '@/components/games/detail/ArtPicker';
import { fetchArtChoices, saveGameArt } from '@/lib/client/game-art';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    alt,
    fill,
    unoptimized,
    ...props
  }: {
    alt: string;
    fill?: boolean;
    unoptimized?: boolean;
    [key: string]: unknown;
  }) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        data-fill={fill ? 'true' : undefined}
        data-unoptimized={unoptimized ? 'true' : undefined}
        {...props}
      />
    );
  },
}));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/client/game-art', () => ({ fetchArtChoices: jest.fn(), saveGameArt: jest.fn() }));

const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/header.jpg';
const choice = (name: string) => ({
  url: `https://cdn2.steamgriddb.com/grid/${name}.png`,
  thumb: `https://cdn2.steamgriddb.com/thumb/${name}.jpg`,
});
const A = choice('a');
const B = choice('b');

const onPreview = jest.fn();
const onDone = jest.fn();
const onCancel = jest.fn();

function open(shown: string | null = STEAM) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <ArtPicker
        gameId={7}
        shown={shown}
        onPreview={onPreview}
        onDone={onDone}
        onCancel={onCancel}
      />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const tile = (name: string | RegExp) => screen.findByRole('button', { name });
const use = () => screen.getByRole('button', { name: 'Use this art' });

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(fetchArtChoices)
    .mockResolvedValue({ original: STEAM, current: STEAM, choices: [A, B] });
});

it('shows placeholders while the choices load, then the original and each image', async () => {
  open();
  expect(screen.getByTestId('art-loading')).toBeInTheDocument();
  expect(use()).toBeDisabled();

  expect(await tile('Original art')).toHaveAttribute('aria-pressed', 'true');
  expect(await tile('Art 1 of 2')).toHaveAttribute('aria-pressed', 'false');
  expect(await tile('Art 2 of 2')).toBeInTheDocument();
  expect(screen.queryByTestId('art-loading')).not.toBeInTheDocument();
  expect(fetchArtChoices).toHaveBeenCalledWith(7);
  // SteamGridDB's small copies, loaded as they are.
  const thumb = document.querySelector(`img[src="${A.thumb}"]`);
  expect(thumb).toHaveAttribute('data-unoptimized', 'true');
});

it('previews a pick in the header before anything is saved', async () => {
  open();
  fireEvent.click(await tile('Art 1 of 2'));

  expect(onPreview).toHaveBeenCalledWith(A.url);
  expect(await tile('Art 1 of 2')).toHaveAttribute('aria-pressed', 'true');
  expect(await tile('Original art')).toHaveAttribute('aria-pressed', 'false');
  expect(saveGameArt).not.toHaveBeenCalled();
  expect(use()).toBeEnabled();
});

it('saves the pick, hands back what the game now shows, and refreshes what lists games', async () => {
  jest.mocked(saveGameArt).mockResolvedValue(A.url);
  const { invalidate } = open();
  fireEvent.click(await tile('Art 1 of 2'));
  fireEvent.click(use());

  await waitFor(() => expect(onDone).toHaveBeenCalledWith(A.url));
  expect(saveGameArt).toHaveBeenCalledWith(7, A.url);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['games'] });
});

it('saves the original as no choice at all', async () => {
  jest.mocked(fetchArtChoices).mockResolvedValue({ original: STEAM, current: A.url, choices: [A] });
  jest.mocked(saveGameArt).mockResolvedValue(STEAM);
  open(A.url);

  expect(await tile('Art 1 of 1')).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(await tile('Original art'));
  fireEvent.click(use());

  await waitFor(() => expect(onDone).toHaveBeenCalledWith(STEAM));
  expect(saveGameArt).toHaveBeenCalledWith(7, null);
});

it("says so when a pick can't be saved, and keeps the picker open", async () => {
  jest.mocked(saveGameArt).mockRejectedValue(new Error('That image can’t be used'));
  open();
  fireEvent.click(await tile('Art 2 of 2'));
  fireEvent.click(use());

  expect(await screen.findByRole('alert')).toHaveTextContent('That image can’t be used');
  expect(onDone).not.toHaveBeenCalled();
});

it('says when SteamGridDB has nothing else, still offering the original', async () => {
  jest.mocked(fetchArtChoices).mockResolvedValue({ original: STEAM, current: STEAM, choices: [] });
  open();

  expect(
    await screen.findByText('SteamGridDB has no other art for this game.'),
  ).toBeInTheDocument();
  expect(await tile('Original art')).toBeInTheDocument();
  expect(use()).toBeDisabled();
});

it("says so when the choices can't be loaded, and tries again", async () => {
  jest.mocked(fetchArtChoices).mockRejectedValueOnce(new Error("Couldn't reach SteamGridDB."));
  open();

  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach SteamGridDB.");
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await tile('Art 1 of 2')).toBeInTheDocument();
});

it('cancels without saving', async () => {
  open();
  fireEvent.click(await tile('Art 1 of 2'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onCancel).toHaveBeenCalled();
  expect(saveGameArt).not.toHaveBeenCalled();
});
