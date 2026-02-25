import { render, screen } from '@testing-library/react';
import { GameCardInfo } from '@/components/games/GameCardInfo';

describe('GameCardInfo', () => {
  describe('game name link', () => {
    it('should render the game name', () => {
      render(<GameCardInfo appId={123} name="Hollow Knight" />);

      expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
    });

    it('should link to the Steam store page', () => {
      render(<GameCardInfo appId={123} name="Hollow Knight" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://store.steampowered.com/app/123/');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('time to beat', () => {
    it('should show hours to beat when provided', () => {
      render(<GameCardInfo appId={1} name="Game" mainStoryHours={8} />);

      expect(screen.getByText('8h')).toBeInTheDocument();
    });

    it('should not show hours to beat when null', () => {
      render(<GameCardInfo appId={1} name="Game" mainStoryHours={null} />);

      expect(screen.queryByTitle('Time to beat')).not.toBeInTheDocument();
    });

    it('should not show hours to beat when not provided', () => {
      render(<GameCardInfo appId={1} name="Game" />);

      expect(screen.queryByTitle('Time to beat')).not.toBeInTheDocument();
    });
  });

  describe('steam review score', () => {
    it('should show review score divided by 10', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={85} />);

      expect(screen.getByText('8.5')).toBeInTheDocument();
    });

    it('should include review count in tooltip when provided', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={90} steamReviewCount={5000} />);

      expect(screen.getByTitle('Steam reviews (5,000 reviews)')).toBeInTheDocument();
    });

    it('should not show review count in tooltip when not provided', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={90} />);

      expect(screen.getByTitle('Steam reviews')).toBeInTheDocument();
    });

    it('should not show review score when null', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={null} />);

      expect(screen.queryByTitle(/steam reviews/i)).not.toBeInTheDocument();
    });
  });

  describe('playtime', () => {
    it('should show playtime when at least 60 minutes', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={120} />);

      expect(screen.getByText('2h played')).toBeInTheDocument();
    });

    it('should show playtime at exactly 60 minutes', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={60} />);

      expect(screen.getByText('1h played')).toBeInTheDocument();
    });

    it('should not show playtime when less than 60 minutes', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={30} />);

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });

    it('should not show playtime when zero', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={0} />);

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });

    it('should not show playtime when not provided', () => {
      render(<GameCardInfo appId={1} name="Game" />);

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });
  });
});
