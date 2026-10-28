import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '@/app/(app)/home/View';
import type { GameWithImage } from '@/types/games';

// Next.js navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ has: () => false }),
  useRouter: () => ({ replace: jest.fn() }),
}));

// Heavy child components that aren't under test
// Manual-game edits are covered by their own tests.
jest.mock('@/hooks/useManualGame', () => ({
  useManualGameActions: () => ({
    dialogProps: () => undefined,
    saveHours: jest.fn(),
    remove: jest.fn(),
  }),
}));
jest.mock('@/components/Header', () => ({ Header: () => <header /> }));
jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
jest.mock('@/components/GameCarousel', () => ({ GameCarousel: () => null }));
const mockOpenAddGame = jest.fn();
jest.mock('@/components/games/AddGameProvider', () => ({
  useAddGame: () => ({ open: mockOpenAddGame }),
}));
const mockConnectSteam = jest.fn();
jest.mock('@/lib/steam/connect', () => ({ connectSteam: () => mockConnectSteam() }));
jest.mock('@/components/SyncProgress', () => ({ SyncProgress: () => null }));
jest.mock('@/components/games/GameStatusModal', () => ({ GameDetailModal: () => null }));
jest.mock('@/components/games/GameSummaryModal', () => ({ GameSummaryModal: () => null }));
jest.mock('@/components/home/HomeLoadingStates', () => ({
  LoadingState: () => null,
  CarouselsLoadingState: () => null,
  StatusLoadingState: () => null,
}));
jest.mock('@/components/suggest', () => ({
  SuggestionModal: ({ isOpen, mode }: { isOpen: boolean; mode: string }) =>
    isOpen ? <div data-testid="suggestion-modal" data-mode={mode} /> : null,
}));
jest.mock('@/components/CurrentlyPlaying', () => ({
  CurrentlyPlaying: ({ game, reveal }: { game: GameWithImage; reveal?: boolean }) => (
    <div data-testid="currently-playing" data-reveal={reveal}>
      {game.name}
    </div>
  ),
}));

const mockUseGameLibrary = jest.fn();
jest.mock('@/hooks/useGameLibrary', () => ({
  useGameLibrary: () => mockUseGameLibrary(),
}));

const baseLibrary = {
  auth: {
    user: { id: 'user-1' },
    profile: { steam_id: 'steam-123' },
    isLoading: false,
  },
  meta: {
    gameCount: 12,
    historyCount: 0,
    backlogCount: 12,
    queuedGameIds: new Set<number>(),
  },
  sync: {
    isSyncing: false,
    progress: { current: 0, total: 0 },
    games: [],
  },
  carousels: {
    pickUp: [],
    moreLike: null,
    shortGames: [],
    weekendGames: [],
    highlyRatedGames: [],
    hiddenGems: [],
    recentlyAdded: [],
    loading: false,
  },
  currentGame: {
    currentlyPlaying: null,
    queue: [],
    isStatusLoading: false,
    statusModal: null,
    gameSummary: null,
    carouselModal: null,
    handlePickGame: jest.fn(),
    handleFinishGame: jest.fn(),
    handleDropGame: jest.fn(),
    handleQueueGame: jest.fn(),
    handleOpenCarouselDetail: jest.fn(),
    handleConfirmCarouselDetail: jest.fn(),
    handleCloseCarouselModal: jest.fn(),
    handleCancelGame: jest.fn(),
    handleMoveCurrentToQueue: jest.fn(),
    handleRandomPick: jest.fn(),
    handleConfirmStatusChange: jest.fn(),
    handleCloseStatusModal: jest.fn(),
    handleCloseSummary: jest.fn(),
  },
};

const mockGame: GameWithImage = {
  id: 1,
  app_id: 1,
  name: 'Hollow Knight',
  header_image: null,
  main_story_hours: 25,
  playtime_forever: 0,
};

beforeEach(() => {
  mockUseGameLibrary.mockReturnValue({ ...baseLibrary });
});

describe('HomeContent — Pick My Game button', () => {
  it('shows "Pick My Game" when no game is currently playing', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: 'Pick My Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick My Next Game' })).not.toBeInTheDocument();
  });

  it('does not show the queue hint when no game is currently playing', () => {
    render(<HomePage />);

    expect(screen.queryByText(/Next in your queue|is empty/)).not.toBeInTheDocument();
  });

  it('opens the suggestion modal in play mode when "Pick My Game" is clicked', async () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick My Game' }));

    // The modal is loaded with next/dynamic, so it appears asynchronously.
    expect(await screen.findByTestId('suggestion-modal')).toHaveAttribute('data-mode', 'play');
  });
});

describe('HomeContent — Pick My Next Game button', () => {
  beforeEach(() => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      currentGame: { ...baseLibrary.currentGame, currentlyPlaying: mockGame },
    });
  });

  it('shows "Pick My Next Game" when a game is currently playing', () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: 'Pick My Next Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick My Game' })).not.toBeInTheDocument();
  });

  it('shows the CurrentlyPlaying component alongside the button', () => {
    render(<HomePage />);

    expect(screen.getByTestId('currently-playing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick My Next Game' })).toBeInTheDocument();
  });

  it('says the queue is empty, with a link to it, when nothing is queued', () => {
    render(<HomePage />);

    expect(screen.getByText(/is empty. The game you pick goes there/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'queue' });
    expect(link).toHaveAttribute('href', '/playing-queue');
  });

  it('shows the next queued game', () => {
    const queued = (id: number, name: string) => ({
      id,
      game_id: id,
      position: id,
      game: { ...mockGame, id, name },
    });
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      currentGame: {
        ...baseLibrary.currentGame,
        currentlyPlaying: mockGame,
        queue: [queued(2, 'Celeste'), queued(3, 'Hades'), queued(4, 'Inside')],
      },
    });
    render(<HomePage />);

    const link = screen.getByRole('link', { name: /Celeste/ });
    expect(link).toHaveAttribute('href', '/playing-queue');
    expect(link).toHaveTextContent('Next in your queue');
    expect(link).not.toHaveTextContent('more');
  });

  it('opens the suggestion modal in queue mode when "Pick My Next Game" is clicked', async () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick My Next Game' }));

    expect(await screen.findByTestId('suggestion-modal')).toHaveAttribute('data-mode', 'queue');
  });
});

describe('HomeContent — an empty library', () => {
  const emptyLibrary = (steamId: string | null) => ({
    ...baseLibrary,
    auth: { ...baseLibrary.auth, profile: { steam_id: steamId } },
    meta: { ...baseLibrary.meta, gameCount: 0, backlogCount: 0 },
  });

  it('offers to add a game or connect Steam, instead of picking from nothing', () => {
    mockUseGameLibrary.mockReturnValue(emptyLibrary(null));
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Build your backlog' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick My Game' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add a game' }));
    expect(mockOpenAddGame).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Steam' }));
    expect(mockConnectSteam).toHaveBeenCalled();
  });

  it('with Steam linked, explains an empty Steam library instead of offering to connect it', () => {
    mockUseGameLibrary.mockReturnValue(emptyLibrary('steam-123'));
    render(<HomePage />);

    expect(screen.getByText(/game details are private/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Steam' })).not.toBeInTheDocument();
  });
});

describe('HomeContent — games but no Steam', () => {
  it('shows the picker, with a quiet way to connect Steam', () => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      auth: { ...baseLibrary.auth, profile: { steam_id: null } },
    });
    render(<HomePage />);

    expect(screen.getByRole('button', { name: 'Pick My Game' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Steam' })).toBeInTheDocument();
  });

  it('says nothing about Steam once it is linked', () => {
    render(<HomePage />);

    expect(screen.queryByRole('button', { name: 'Connect Steam' })).not.toBeInTheDocument();
  });
});

describe('HomeContent — fewer than 3 games to pick from', () => {
  it('keeps asking for games, with progress toward 3', () => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      auth: { ...baseLibrary.auth, profile: { steam_id: null } },
      meta: { ...baseLibrary.meta, gameCount: 1, historyCount: 0, backlogCount: 1 },
    });
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Build your backlog' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('1 of 3 games')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick My Game' })).not.toBeInTheDocument();
  });

  it("says finished and dropped games don't count, so adding one doesn't look broken", () => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      auth: { ...baseLibrary.auth, profile: { steam_id: null } },
      meta: { ...baseLibrary.meta, gameCount: 2, historyCount: 1, backlogCount: 1 },
    });
    render(<HomePage />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText(/finished and dropped don't count/)).toBeInTheDocument();
  });
});

describe('HomeContent — Random', () => {
  it('flicks through the backlog while it picks, in place of the picker', () => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      currentGame: { ...baseLibrary.currentGame, rollCovers: ['https://a.jpg', 'https://b.jpg'] },
    });
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'Rolling the dice…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Random' })).not.toBeInTheDocument();
  });

  it('brings the game it picked into focus as it starts playing', () => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      currentGame: { ...baseLibrary.currentGame, currentlyPlaying: mockGame, rolledGameId: 1 },
    });
    render(<HomePage />);

    expect(screen.getByTestId('currently-playing')).toHaveAttribute('data-reveal', 'true');
  });
});

describe('HomeContent — nothing left to pick', () => {
  // Both picks leave queued games out, so a backlog that's all queued has none.
  const allQueued = (ids: number[]) => ({
    ...baseLibrary.meta,
    backlogCount: ids.length,
    queuedGameIds: new Set(ids),
  });

  it('offers Add a game instead of Pick My Next Game while one plays and the rest are queued', () => {
    mockUseGameLibrary.mockReturnValue({
      ...baseLibrary,
      meta: allQueued([2, 3]),
      currentGame: { ...baseLibrary.currentGame, currentlyPlaying: mockGame },
    });
    render(<HomePage />);

    expect(screen.queryByRole('button', { name: 'Pick My Next Game' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a game' })).toBeInTheDocument();
  });

  it('points at the queue instead of offering picks when nothing plays and all is queued', () => {
    mockUseGameLibrary.mockReturnValue({ ...baseLibrary, meta: allQueued([1, 2, 3]) });
    render(<HomePage />);

    expect(screen.queryByRole('button', { name: 'Pick My Game' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Random' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to your queue' })).toBeInTheDocument();
    expect(screen.getByText(/already in your queue/)).toBeInTheDocument();
  });
});

describe('HomeContent — a small backlog', () => {
  const small = (steamId: string | null) => ({
    ...baseLibrary,
    auth: { ...baseLibrary.auth, profile: { steam_id: steamId } },
    meta: { ...baseLibrary.meta, gameCount: 4, backlogCount: 4 },
  });

  it('says picks get better with more games, and how to add them', () => {
    mockUseGameLibrary.mockReturnValue(small(null));
    render(<HomePage />);

    expect(screen.getByText(/Picks get better the more games you have/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a few more' }));
    expect(mockOpenAddGame).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'connect Steam' })).toBeInTheDocument();
  });

  it('leaves Steam out of it once Steam is connected', () => {
    mockUseGameLibrary.mockReturnValue(small('steam-123'));
    render(<HomePage />);

    expect(screen.getByText(/Picks get better/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'connect Steam' })).not.toBeInTheDocument();
  });

  it('says nothing about it for a backlog of 10 or more', () => {
    render(<HomePage />);
    expect(screen.queryByText(/Picks get better/)).not.toBeInTheDocument();
  });
});
