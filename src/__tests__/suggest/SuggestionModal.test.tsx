import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuggestionModal } from '@/components/suggest/SuggestionModal';
import { findRandomBacklogGame } from '@/lib/games/random-pick';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/games/random-pick', () => ({
  ...jest.requireActual('@/lib/games/random-pick'),
  findRandomBacklogGame: jest.fn(),
}));

const celeste = {
  id: 4,
  app_id: 504230,
  source: 'steam',
  platform: 'PC',
  name: 'Celeste',
  header_image: null,
  main_story_hours: 8,
  genres: ['Platformer'],
  tags: ['Precision Platformer'],
  steam_review_score: 97,
  steam_review_count: 1000,
  critic_score: 91,
  critic_count: 10,
  playtime_forever: 0,
  last_played_at: null,
};

function setup(mode: 'play' | 'queue') {
  const onPick = jest.fn();
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SuggestionModal isOpen onClose={onClose} onPick={onPick} mode={mode} />
    </QueryClientProvider>,
  );
  return { onPick, onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(findRandomBacklogGame).mockResolvedValue({ game: celeste });
});

it('offers leaving it to chance when picking for the queue, not when starting a game', () => {
  setup('play');
  expect(screen.queryByRole('button', { name: /Leave it to chance/ })).not.toBeInTheDocument();
});

it('rolls a random game, then adds it to the queue or rolls again', async () => {
  const { onPick, onClose } = setup('queue');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });

  expect(screen.getByText('Left to chance')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Celeste' })).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Roll again/ }));
  });
  expect(findRandomBacklogGame).toHaveBeenCalledTimes(2);

  fireEvent.click(screen.getByRole('button', { name: 'Add to Queue' }));
  expect(onPick).toHaveBeenCalledWith(celeste);
  expect(onClose).toHaveBeenCalled();
});

it("says so when there's nothing left to pick, and goes back to the questions", async () => {
  jest.mocked(findRandomBacklogGame).mockResolvedValue({ error: 'none' });
  setup('queue');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Leave it to chance/ }));
  });
  expect(screen.getByText(/no backlog game left to pick/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Change answers' }));
  expect(screen.getByRole('button', { name: /Leave it to chance/ })).toBeInTheDocument();
});
