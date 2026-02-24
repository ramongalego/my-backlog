import { render, screen, fireEvent } from '@testing-library/react';
import { GamesFilter } from '@/components/games/GamesFilter';
import type { FilterCounts } from '@/hooks/useGamesPage';

describe('GamesFilter', () => {
  const mockCounts: FilterCounts = {
    all: 100,
    playing: 3,
    backlog: 50,
    finished: 30,
    dropped: 15,
    hidden: 5,
  };

  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render all filter buttons including playing when count > 0', () => {
      render(<GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />);

      expect(screen.getByText(/All/)).toBeInTheDocument();
      expect(screen.getByText(/Playing/)).toBeInTheDocument();
      expect(screen.getByText(/Backlog/)).toBeInTheDocument();
      expect(screen.getByText(/Finished/)).toBeInTheDocument();
      expect(screen.getByText(/Dropped/)).toBeInTheDocument();
      expect(screen.getByText(/Hidden/)).toBeInTheDocument();
    });

    it('should hide the playing filter when count is 0', () => {
      const noPlayingCounts: FilterCounts = { ...mockCounts, playing: 0 };
      render(
        <GamesFilter filter="all" counts={noPlayingCounts} onFilterChange={mockOnFilterChange} />,
      );

      expect(screen.queryByText(/Playing/)).not.toBeInTheDocument();
    });

    it('should display counts for each filter', () => {
      render(<GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />);

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should highlight active filter', () => {
      const { rerender } = render(
        <GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />,
      );

      // All button should have active styles
      const allButton = screen.getByText(/All/).closest('button');
      expect(allButton).toHaveClass('bg-zinc-100', 'text-zinc-900');

      // Rerender with different filter
      rerender(
        <GamesFilter filter="finished" counts={mockCounts} onFilterChange={mockOnFilterChange} />,
      );

      // Finished button should now have active styles
      const finishedButton = screen.getByText(/Finished/).closest('button');
      expect(finishedButton).toHaveClass('bg-zinc-100', 'text-zinc-900');
    });
  });

  describe('interactions', () => {
    it('should call onFilterChange when All clicked', () => {
      render(
        <GamesFilter filter="backlog" counts={mockCounts} onFilterChange={mockOnFilterChange} />,
      );

      fireEvent.click(screen.getByText(/All/));

      expect(mockOnFilterChange).toHaveBeenCalledWith('all');
    });

    it('should call onFilterChange when Backlog clicked', () => {
      render(<GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />);

      fireEvent.click(screen.getByText(/Backlog/));

      expect(mockOnFilterChange).toHaveBeenCalledWith('backlog');
    });

    it('should call onFilterChange when Finished clicked', () => {
      render(<GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />);

      fireEvent.click(screen.getByText(/Finished/));

      expect(mockOnFilterChange).toHaveBeenCalledWith('finished');
    });

    it('should call onFilterChange when Dropped clicked', () => {
      render(<GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />);

      fireEvent.click(screen.getByText(/Dropped/));

      expect(mockOnFilterChange).toHaveBeenCalledWith('dropped');
    });

    it('should call onFilterChange when Hidden clicked', () => {
      render(<GamesFilter filter="all" counts={mockCounts} onFilterChange={mockOnFilterChange} />);

      fireEvent.click(screen.getByText(/Hidden/));

      expect(mockOnFilterChange).toHaveBeenCalledWith('hidden');
    });
  });
});
