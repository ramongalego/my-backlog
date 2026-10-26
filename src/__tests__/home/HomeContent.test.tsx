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
jest.mock('@/components/SyncProgress', () => ({ SyncProgress: () => null }));
jest.mock('@/components/LandingPage', () => ({ LandingPage: () => null }));
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
  CurrentlyPlaying: ({ game }: { game: GameWithImage }) => (
    <div data-testid="currently-playing">{game.name}</div>
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
    gameCount: 0,
    historyCount: 0,
    queuedAppIds: new Set<number>(),
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
  handleConnectSteam: jest.fn(),
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

  it('shows the next queued game and how many follow it', () => {
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
    expect(link).toHaveTextContent('Next in your queue · 2 more after it');
  });

  it('opens the suggestion modal in queue mode when "Pick My Next Game" is clicked', async () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick My Next Game' }));

    expect(await screen.findByTestId('suggestion-modal')).toHaveAttribute('data-mode', 'queue');
  });
});
