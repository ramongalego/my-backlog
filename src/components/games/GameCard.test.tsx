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
  source: 'steam',
  platform: null,
  id: 123,
  app_id: 123,
  name: 'Test Game',
  playtime_forever: 120,
  steam_review_score: 85,
  steam_review_count: 1000,
  critic_score: null,
  critic_count: null,
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

  it('shows the console of games added by hand on the art, named for screen readers', () => {
    const { rerender } = render(
      <GameCard
        game={createGame({ source: 'manual', platform: 'Switch 2', app_id: null })}
        onOpenDetail={mockOnOpenDetail}
      />,
    );
    // A tag on the art, hidden from screen readers...
    expect(screen.getByText('Switch 2').closest('[aria-hidden="true"]')).not.toBeNull();
    // ...which read the console in the meta row instead.
    expect(screen.getByText('On Switch 2')).toHaveClass('sr-only');

    // Steam games are all "PC", which isn't worth a label on every card.
    rerender(<GameCard game={createGame({ platform: 'PC' })} onOpenDetail={mockOnOpenDetail} />);
    expect(screen.queryByText(/PC/)).not.toBeInTheDocument();
  });
  it('keeps Steam reviews on a Steam game moved to a console, but not its Deck rating', () => {
    render(
      <GameCard
        game={createGame({
          source: 'steam',
          platform: 'Switch',
          steam_review_score: 85,
          deck_compat: 3,
        })}
        onOpenDetail={mockOnOpenDetail}
      />,
    );
    expect(screen.getByText('Switch')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.queryByText('Deck')).not.toBeInTheDocument();
  });

  it('shows the Steam reviews of a game added by hand that Steam sells, behind its critic score', () => {
    render(
      <GameCard
        game={createGame({
          source: 'manual',
          app_id: null,
          platform: 'PS5',
          critic_score: 89,
          critic_count: 8,
          steam_review_score: 92,
          steam_review_count: 30000,
        })}
        onOpenDetail={mockOnOpenDetail}
      />,
    );
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('tooltip')
        .some((t) => t.textContent?.includes('92% of 30,000 Steam reviews')),
    ).toBe(true);
  });

  it('shows Steam reviews and Deck for a Steam game played on Steam', () => {
    render(
      <GameCard
        game={createGame({
          source: 'steam',
          platform: 'PC',
          steam_review_score: 85,
          deck_compat: 3,
        })}
        onOpenDetail={mockOnOpenDetail}
      />,
    );
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Deck')).toBeInTheDocument();
  });

  it("tags a game that isn't out yet, beside its console, and says so in its name", () => {
    render(
      <GameCard
        game={createGame({ source: 'manual', platform: 'Switch 2', release_date: 'Nov 5, 2099' })}
        onOpenDetail={mockOnOpenDetail}
      />,
    );
    expect(screen.getByText('Out Nov 5, 2099')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /, Out Nov 5, 2099$/ })).toBeInTheDocument();
  });

  it('has no release tag once the game is out', () => {
    render(
      <GameCard
        game={createGame({ release_date: 'Nov 5, 2020' })}
        onOpenDetail={mockOnOpenDetail}
      />,
    );
    expect(screen.queryByText(/^Out /)).not.toBeInTheDocument();
  });
});
