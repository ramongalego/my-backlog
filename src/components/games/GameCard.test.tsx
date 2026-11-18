import { render, screen, fireEvent } from '@testing-library/react';
import { GameCard } from '@/components/games/GameCard';
import { ratingOf } from '@/lib/games/rating';

const shown = (game: GameItem) => String(Math.round(ratingOf(game)!));
import type { GameItem } from '@/lib/data/loaders';
import type { LibraryPlatforms } from '@/lib/games/consoles';

// Not known yet unless a test sets it.
let mockLibrary: LibraryPlatforms | null = null;
jest.mock('@/hooks/useLibraryMeta', () => ({
  ...jest.requireActual('@/hooks/useLibraryMeta'),
  useLibraryPlatforms: () => mockLibrary,
}));
beforeEach(() => {
  mockLibrary = null;
});

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
  status: 'backlog',
  notes: null,
  rating: null,
  finished_at: null,
  dropped_at: null,
  tags: null,
  ...overrides,
});

describe('GameCard in Select mode', () => {
  const onOpenDetail = jest.fn();
  const onToggle = jest.fn();
  const card = (selection: { selected: boolean; selectable: boolean }, queued = false) =>
    render(
      <GameCard
        game={createGame({ name: 'Hades' })}
        onOpenDetail={onOpenDetail}
        queued={queued}
        selection={{ ...selection, onToggle }}
      />,
    );

  beforeEach(() => jest.clearAllMocks());

  it('ticks the game instead of opening it', () => {
    card({ selected: false, selectable: true });
    const button = screen.getByRole('button', { name: 'Select Hades' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('asks for the range on a shift-click', () => {
    card({ selected: false, selectable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Select Hades' }), { shiftKey: true });
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('shows a ticked game as pressed', () => {
    card({ selected: true, selectable: true });
    expect(screen.getByRole('button', { name: 'Select Hades' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it("can't tick a queued game, and says why", () => {
    card({ selected: false, selectable: false }, true);
    const button = screen.getByRole('button', {
      name: 'Hades, queued: change it from its own dialog',
    });
    expect(button).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(button);

    expect(onToggle).not.toHaveBeenCalled();
    expect(onOpenDetail).not.toHaveBeenCalled();
  });
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
    ] as const)('should show %s badge', (status, label) => {
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
    const game = createGame({
      source: 'steam',
      platform: 'Switch',
      steam_review_score: 85,
      deck_compat: 3,
    });
    render(<GameCard game={game} onOpenDetail={mockOnOpenDetail} />);
    expect(screen.getByText('Switch')).toBeInTheDocument();
    expect(screen.getByText(shown(game))).toBeInTheDocument();
    expect(screen.queryByText('Deck')).not.toBeInTheDocument();
  });

  it('shows the Steam reviews of a game added by hand that Steam sells, behind its critic score', () => {
    const game = createGame({
      source: 'manual',
      app_id: null,
      platform: 'PS5',
      critic_score: 89,
      critic_count: 8,
      steam_review_score: 92,
      steam_review_count: 30000,
    });
    render(<GameCard game={game} onOpenDetail={mockOnOpenDetail} />);
    expect(screen.getByText(shown(game))).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('tooltip')
        .some((t) => t.textContent?.includes('92% of 30,000 Steam reviews')),
    ).toBe(true);
  });

  it('shows Steam reviews and Deck for a Steam game played on Steam', () => {
    const game = createGame({
      source: 'steam',
      platform: 'PC',
      steam_review_score: 85,
      deck_compat: 3,
    });
    render(<GameCard game={game} onOpenDetail={mockOnOpenDetail} />);
    expect(screen.getByText(shown(game))).toBeInTheDocument();
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

  describe('the platform tag, by what the library is on', () => {
    const steamGame = () =>
      createGame({ name: 'Hades', source: 'steam', platform: 'PC', deck_compat: 3 });
    const ps5Game = () =>
      createGame({ name: 'Astro Bot', source: 'manual', platform: 'PS5', app_id: null });
    const card = (game: GameItem) =>
      render(<GameCard game={game} onOpenDetail={mockOnOpenDetail} />);

    it('tags consoles and leaves PC untagged in a library mostly on PC', () => {
      mockLibrary = { main: 'PC', count: 2 };
      card(steamGame());
      expect(screen.queryByText(/PC/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open details for Hades' })).toBeInTheDocument();
    });

    it('tags a console game in a library mostly on PC, in its name too', () => {
      mockLibrary = { main: 'PC', count: 2 };
      card(ps5Game());
      expect(screen.getByText('PS5').closest('[aria-hidden="true"]')).not.toBeNull();
      expect(screen.getByText('On PS5')).toHaveClass('sr-only');
      expect(
        screen.getByRole('button', { name: 'Open details for Astro Bot, PS5' }),
      ).toBeInTheDocument();
    });

    it('tags a Steam game "PC" in a library mostly on PS5, keeping its Steam link and Deck rating', () => {
      mockLibrary = { main: 'PS5', count: 2 };
      card(steamGame());
      expect(screen.getByText('PC').closest('[aria-hidden="true"]')).not.toBeNull();
      expect(screen.getByText('On PC')).toHaveClass('sr-only');
      expect(
        screen.getByRole('button', { name: 'Open details for Hades, PC' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Hades/ })).toBeInTheDocument();
      expect(screen.getByText('Deck')).toBeInTheDocument();
    });

    it("leaves a PS5 game untagged in a library mostly on PS5, and doesn't name it", () => {
      mockLibrary = { main: 'PS5', count: 2 };
      card(ps5Game());
      expect(screen.queryByText(/PS5/)).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open details for Astro Bot' }),
      ).toBeInTheDocument();
    });

    it('tags nothing in a library all on one platform', () => {
      mockLibrary = { main: 'PS5', count: 1 };
      card(ps5Game());
      expect(screen.queryByText(/PS5/)).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open details for Astro Bot' }),
      ).toBeInTheDocument();
    });

    it('tags nothing, and names no platform, with the page filtered to one platform', () => {
      mockLibrary = { main: 'PS5', count: 2 };
      render(<GameCard game={steamGame()} onOpenDetail={mockOnOpenDetail} showPlatform={false} />);
      expect(screen.queryByText(/PC/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open details for Hades' })).toBeInTheDocument();
      // Still a Steam game: its link and Deck rating stay.
      expect(screen.getByRole('link', { name: /Hades/ })).toBeInTheDocument();
      expect(screen.getByText('Deck')).toBeInTheDocument();
    });

    it('names no platform when selecting, with the page filtered to one platform', () => {
      mockLibrary = { main: 'PC', count: 2 };
      render(
        <GameCard
          game={ps5Game()}
          onOpenDetail={mockOnOpenDetail}
          showPlatform={false}
          selection={{ selected: false, selectable: true, onToggle: jest.fn() }}
        />,
      );
      expect(screen.queryByText(/PS5/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select Astro Bot' })).toBeInTheDocument();
    });

    it('tags only consoles until the library is known, as before', () => {
      const { unmount } = card(steamGame());
      expect(screen.queryByText(/PC/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open details for Hades' })).toBeInTheDocument();
      unmount();
      card(ps5Game());
      expect(screen.getByText('On PS5')).toHaveClass('sr-only');
      expect(
        screen.getByRole('button', { name: 'Open details for Astro Bot, PS5' }),
      ).toBeInTheDocument();
    });
  });
});
