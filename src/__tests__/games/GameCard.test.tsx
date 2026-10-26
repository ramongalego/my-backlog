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
  created_at: '2026-01-01T00:00:00Z',
  release_date: null,
  last_played_at: null,
  id: 123,
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

      expect(screen.getByText('2h')).toBeInTheDocument();
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
      ['playing', 'Playing'],
      ['wont_play', "Won't Play"],
    ])('should show %s badge', (status, label) => {
      render(<GameCard game={createGame({ status })} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('should not badge backlog games, since backlog is the default', () => {
      render(<GameCard game={createGame({ status: 'backlog' })} onOpenDetail={mockOnOpenDetail} />);

      expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
    });
  });

  it('should call onOpenDetail with the game id when clicked', () => {
    render(<GameCard game={createGame({ id: 7, app_id: 123 })} onOpenDetail={mockOnOpenDetail} />);

    fireEvent.click(screen.getByRole('button', { name: /open details/i }));

    expect(mockOnOpenDetail).toHaveBeenCalledWith(7);
  });

  it('links the title to the Steam store for Steam games only', () => {
    const { rerender } = render(<GameCard game={createGame()} onOpenDetail={mockOnOpenDetail} />);
    expect(screen.getByRole('link', { name: /test game/i })).toHaveAttribute(
      'href',
      'https://store.steampowered.com/app/123/',
    );

    rerender(<GameCard game={createGame({ app_id: null })} onOpenDetail={mockOnOpenDetail} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Test Game')).toBeInTheDocument();
  });
});
