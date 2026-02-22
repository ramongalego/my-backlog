import { render, screen, fireEvent } from '@testing-library/react';
import { GameCard } from '@/components/games/GameCard';
import type { GameItem } from '@/hooks/useGamesPage';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    alt,
    fill,
    ...props
  }: {
    alt: string;
    fill?: boolean;
    [key: string]: unknown;
  }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} data-fill={fill ? 'true' : undefined} {...props} />;
  },
}));

const createGame = (overrides: Partial<GameItem> = {}): GameItem => ({
  app_id: 123,
  name: 'Test Game',
  playtime_forever: 120,
  steam_review_score: 85,
  steam_review_count: 1000,
  steam_review_weighted: 82,
  header_image: 'https://example.com/image.jpg',
  main_story_hours: 10,
  status: null,
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  ...overrides,
});

describe('GameCard', () => {
  const mockOnOpenDetail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render game name', () => {
      render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('Test Game')).toBeInTheDocument();
    });

    it('should render game image when available', () => {
      render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

      const img = screen.getByAltText('Test Game');
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('should render placeholder when no image', () => {
      render(
        <GameCard game={createGame({ header_image: null })} onOpenDetail={mockOnOpenDetail} />,
      );

      expect(screen.queryByAltText('Test Game')).not.toBeInTheDocument();
    });

    it('should render main story hours', () => {
      render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('10h')).toBeInTheDocument();
    });

    it('should render playtime', () => {
      render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('2h played')).toBeInTheDocument();
    });

    it('should not render playtime when zero', () => {
      render(
        <GameCard game={createGame({ playtime_forever: 0 })} onOpenDetail={mockOnOpenDetail} />,
      );

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    it('should show Finished badge for finished games', () => {
      render(
        <GameCard game={createGame({ status: 'finished' })} onOpenDetail={mockOnOpenDetail} />,
      );

      expect(screen.getByText('Finished')).toBeInTheDocument();
    });

    it('should show Dropped badge for dropped games', () => {
      render(<GameCard game={createGame({ status: 'dropped' })} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('Dropped')).toBeInTheDocument();
    });

    it('should show Hidden badge for hidden games', () => {
      render(<GameCard game={createGame({ status: 'hidden' })} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('Hidden')).toBeInTheDocument();
    });

    it('should show Backlog badge for backlog games', () => {
      render(<GameCard game={createGame({ status: 'backlog' })} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('Backlog')).toBeInTheDocument();
    });
  });

  describe('image button interaction', () => {
    it('should call onOpenDetail when image area is clicked', () => {
      render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

      fireEvent.click(screen.getByRole('button', { name: /open details/i }));

      expect(mockOnOpenDetail).toHaveBeenCalledWith(123);
    });

    it('should call onOpenDetail for finished games', () => {
      render(
        <GameCard game={createGame({ status: 'finished' })} onOpenDetail={mockOnOpenDetail} />,
      );

      fireEvent.click(screen.getByRole('button', { name: /open details/i }));

      expect(mockOnOpenDetail).toHaveBeenCalledWith(123);
    });
  });
});
