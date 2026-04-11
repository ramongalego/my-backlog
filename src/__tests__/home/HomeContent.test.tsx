import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '@/app/home/page';
import type { GameWithImage } from '@/types/games';

// Next.js navigation
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ has: () => false }),
  useRouter: () => ({ replace: jest.fn() }),
}));

// Heavy child components that aren't under test
jest.mock('@/components/Header', () => ({ Header: () => <header /> }));
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
    shortGames: [],
    weekendGames: [],
    highlyRatedGames: [],
    hiddenGems: [],
    recentlyAdded: [],
    loading: false,
  },
  currentGame: {
    currentlyPlaying: null,
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
    handleRandomPick: jest.fn(),
    handleConfirmStatusChange: jest.fn(),
    handleCloseStatusModal: jest.fn(),
    handleCloseSummary: jest.fn(),
  },
  handleConnectSteam: jest.fn(),
};

const mockGame: GameWithImage = {
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

    expect(screen.queryByText(/added to your/)).not.toBeInTheDocument();
  });

  it('opens the suggestion modal in play mode when "Pick My Game" is clicked', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick My Game' }));

    expect(screen.getByTestId('suggestion-modal')).toHaveAttribute('data-mode', 'play');
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

  it('shows the queue hint text with a link to /playing-queue', () => {
    render(<HomePage />);

    expect(screen.getByText(/added to your/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'queue' });
    expect(link).toHaveAttribute('href', '/playing-queue');
  });

  it('opens the suggestion modal in queue mode when "Pick My Next Game" is clicked', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Pick My Next Game' }));

    expect(screen.getByTestId('suggestion-modal')).toHaveAttribute('data-mode', 'queue');
  });
});
