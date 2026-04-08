import { render, screen, fireEvent } from '@testing-library/react';
import { GameCard } from '@/components/games/GameCard';
import type { GameItem } from '@/hooks/useGamesPage';

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
  tags: null,
  ...overrides,
});

describe('GameCard', () => {
  const mockOnOpenDetail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('playtime display', () => {
    it('should show playtime when at least 1 hour', () => {
      render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText('2h played')).toBeInTheDocument();
    });

    it('should not show playtime when zero', () => {
      render(
        <GameCard game={createGame({ playtime_forever: 0 })} onOpenDetail={mockOnOpenDetail} />,
      );

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });

    it('should not show playtime when less than one hour', () => {
      render(
        <GameCard game={createGame({ playtime_forever: 30 })} onOpenDetail={mockOnOpenDetail} />,
      );

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    it.each([
      ['finished', 'Finished'],
      ['dropped', 'Dropped'],
      ['hidden', 'Hidden'],
      ['backlog', 'Backlog'],
      ['playing', 'Playing'],
    ])('should show %s badge', (status, label) => {
      render(<GameCard game={createGame({ status })} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('should call onOpenDetail with app_id when clicked', () => {
    render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);

    fireEvent.click(screen.getByRole('button', { name: /open details/i }));

    expect(mockOnOpenDetail).toHaveBeenCalledWith(123);
  });
});
