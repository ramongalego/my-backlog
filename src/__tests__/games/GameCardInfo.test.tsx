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

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('steam review score', () => {
    it('should show the percent positive, the way Steam does', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={85} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should put the Steam label and review count in the tooltip', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={90} steamReviewCount={5000} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Very Positive');
      expect(tooltip).toHaveTextContent('90% of 5,000 Steam reviews are positive');
    });

    it('should not show review score when null', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={null} />);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('should explain the time to beat is the main story, from HowLongToBeat', () => {
    render(<GameCardInfo appId={1} name="Game" mainStoryHours={8} />);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Time to beat: Main Story');
    expect(screen.getByRole('tooltip')).toHaveTextContent('From HowLongToBeat');
  });

  it('should label the Steam Deck rating and describe it on focus', () => {
    render(<GameCardInfo appId={1} name="Game" deckCompat={3} />);

    expect(screen.getByText('Deck')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Steam Deck Verified');
  });

  describe('playtime', () => {
    it('should show playtime when at least 60 minutes', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={120} />);

      // Icon and hours, like the other meta-row indicators.
      expect(screen.getByText('2h')).toBeVisible();
    });

    it('should say when you last played in the tooltip', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60_000).toISOString();
      render(
        <GameCardInfo appId={1} name="Game" playtimeMinutes={600} lastPlayedAt={threeDaysAgo} />,
      );

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Last played 3 days ago');
      expect(tooltip).toHaveTextContent('10h played on Steam');
    });

    it('should fall back to the playtime source when Steam has no date', () => {
      render(<GameCardInfo appId={1} name="Game" playtimeMinutes={600} />);

      expect(screen.getByRole('tooltip')).toHaveTextContent('Playtime from Steam');
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
