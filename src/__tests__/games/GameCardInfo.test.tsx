import { render, screen } from '@testing-library/react';
import { GameCardInfo } from '@/components/games/GameCardInfo';

describe('GameCardInfo', () => {
  describe('time to beat', () => {
    it('should show hours when provided', () => {
      render(<GameCardInfo appId={1} name="Game" mainStoryHours={8} />);

      expect(screen.getByText('8h')).toBeInTheDocument();
    });

    it('should not show hours when null', () => {
      render(<GameCardInfo appId={1} name="Game" mainStoryHours={null} />);

      expect(screen.queryByTitle('Time to beat')).not.toBeInTheDocument();
    });
  });

  describe('steam review score', () => {
    it('should show the percent positive, the way Steam does', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={85} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should put the Steam label and review count in the tooltip', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={90} steamReviewCount={5000} />);

      expect(screen.getByTitle('Very Positive · 5,000 Steam reviews')).toBeInTheDocument();
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

    it('should not show playtime when under 60 minutes', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={30} />);

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });

    it('should not show playtime when zero', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={0} />);

      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });
  });
});
