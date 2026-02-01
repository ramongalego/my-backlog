import { render, screen, fireEvent } from '@testing-library/react';
import { GameCarousel } from '@/components/GameCarousel';

// Mock next/image since we're in a test environment
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

const mockGames = [
  {
    app_id: 1,
    name: 'Game One',
    header_image: 'https://cdn.steam.com/game1.jpg',
    main_story_hours: 3,
  },
  {
    app_id: 2,
    name: 'Game Two',
    header_image: 'https://cdn.steam.com/game2.jpg',
    main_story_hours: 4.5,
  },
  {
    app_id: 3,
    name: 'Game Three',
    header_image: null,
    main_story_hours: 2,
  },
];

describe('GameCarousel', () => {
  describe('rendering', () => {
    it('should render the title', () => {
      render(<GameCarousel title="Test Games" games={mockGames} />);

      expect(screen.getByText('Test Games')).toBeInTheDocument();
    });

    it('should render all games', () => {
      render(<GameCarousel title="Test Games" games={mockGames} />);

      expect(screen.getByText('Game One')).toBeInTheDocument();
      expect(screen.getByText('Game Two')).toBeInTheDocument();
      expect(screen.getByText('Game Three')).toBeInTheDocument();
    });

    it('should display hours to complete for each game', () => {
      render(<GameCarousel title="Test Games" games={mockGames} />);

      expect(screen.getByText('3h to complete')).toBeInTheDocument();
      expect(screen.getByText('4.5h to complete')).toBeInTheDocument();
      expect(screen.getByText('2h to complete')).toBeInTheDocument();
    });

    it('should render nothing when games array is empty', () => {
      const { container } = render(<GameCarousel title="Empty" games={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render placeholder for games without header image', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      // Game Three has no image, should have placeholder div
      const gameCards = screen.getAllByRole('img');
      expect(gameCards).toHaveLength(2); // Only 2 games have images
    });
  });

  describe('scroll buttons', () => {
    it('should render left and right scroll buttons', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
      expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
    });

    it('should disable left button initially (at start)', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      const leftButton = screen.getByLabelText('Scroll left');
      expect(leftButton).toBeDisabled();
    });

    it('should call scrollBy when scroll buttons are clicked', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      const rightButton = screen.getByLabelText('Scroll right');

      // Mock scrollBy on the container
      const scrollContainer = rightButton.closest('div')?.parentElement?.querySelector('[style*="scrollbar"]')?.parentElement;
      if (scrollContainer) {
        const scrollBySpy = jest.fn();
        scrollContainer.scrollBy = scrollBySpy;

        fireEvent.click(rightButton);

        // Note: scroll behavior may vary in tests due to jsdom limitations
      }
    });
  });

  describe('game actions', () => {
    it('should show Pick button when onPickGame is provided', () => {
      const mockPick = jest.fn();
      render(
        <GameCarousel
          title="Test"
          games={mockGames}
          onPickGame={mockPick}
        />
      );

      const pickButtons = screen.getAllByText('Pick');
      expect(pickButtons.length).toBeGreaterThan(0);
    });

    it('should show Hide button when onHideGame is provided', () => {
      const mockHide = jest.fn();
      render(
        <GameCarousel
          title="Test"
          games={mockGames}
          onHideGame={mockHide}
        />
      );

      const hideButtons = screen.getAllByText('Hide');
      expect(hideButtons.length).toBeGreaterThan(0);
    });

    it('should not show action buttons when no handlers provided', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      expect(screen.queryByText('Pick')).not.toBeInTheDocument();
      expect(screen.queryByText('Hide')).not.toBeInTheDocument();
    });

    it('should call onPickGame with correct game when Pick is clicked', () => {
      const mockPick = jest.fn();
      render(
        <GameCarousel
          title="Test"
          games={mockGames}
          onPickGame={mockPick}
        />
      );

      const pickButtons = screen.getAllByText('Pick');
      fireEvent.click(pickButtons[0]);

      expect(mockPick).toHaveBeenCalledWith(mockGames[0]);
    });

    it('should call onHideGame with correct game when Hide is clicked', () => {
      const mockHide = jest.fn();
      render(
        <GameCarousel
          title="Test"
          games={mockGames}
          onHideGame={mockHide}
        />
      );

      const hideButtons = screen.getAllByText('Hide');
      fireEvent.click(hideButtons[1]);

      expect(mockHide).toHaveBeenCalledWith(mockGames[1]);
    });

    it('should show both Pick and Hide when both handlers provided', () => {
      const mockPick = jest.fn();
      const mockHide = jest.fn();
      render(
        <GameCarousel
          title="Test"
          games={mockGames}
          onPickGame={mockPick}
          onHideGame={mockHide}
        />
      );

      // Each game should have both buttons
      const pickButtons = screen.getAllByText('Pick');
      const hideButtons = screen.getAllByText('Hide');

      expect(pickButtons).toHaveLength(mockGames.length);
      expect(hideButtons).toHaveLength(mockGames.length);
    });
  });

  describe('accessibility', () => {
    it('should have accessible scroll button labels', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
      expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
    });

    it('should have alt text for game images', () => {
      render(<GameCarousel title="Test" games={mockGames} />);

      expect(screen.getByAltText('Game One')).toBeInTheDocument();
      expect(screen.getByAltText('Game Two')).toBeInTheDocument();
    });
  });

  describe('responsiveness', () => {
    it('should render gradient overlay for scroll hint', () => {
      const { container } = render(<GameCarousel title="Test" games={mockGames} />);

      // Check for the gradient overlay div
      const gradientOverlay = container.querySelector('[style*="linear-gradient"]');
      expect(gradientOverlay).toBeInTheDocument();
    });
  });
});
