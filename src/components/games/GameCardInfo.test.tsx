import { render, screen } from '@testing-library/react';
import { GameCardInfo } from '@/components/games/GameCardInfo';
import { ratingOf } from '@/lib/games/rating';

// The figure a card shows: the rating games are ranked by, rounded.
const shown = (game: Parameters<typeof ratingOf>[0]) => String(Math.round(ratingOf(game)!));

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

  describe('critic score', () => {
    it('shows the rating games are ranked by, with the critic and Steam scores on hover', () => {
      render(
        <GameCardInfo
          appId={1}
          name="Game"
          criticScore={88}
          criticCount={9}
          steamReviewScore={94}
          steamReviewCount={12345}
        />,
      );

      expect(
        screen.getByText(
          shown({
            critic_score: 88,
            critic_count: 9,
            steam_review_score: 94,
            steam_review_count: 12345,
          }),
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('94%')).not.toBeInTheDocument();
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent("Critic score: 88The average of 9 critics' reviews");
      expect(tooltip).toHaveTextContent('94% of 12,345 Steam reviews are positive');
    });

    it('needs 3 reviews, else Steam reviews show', () => {
      render(
        <GameCardInfo
          appId={1}
          name="Game"
          criticScore={100}
          criticCount={1}
          steamReviewScore={95}
        />,
      );

      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.queryByText('100')).not.toBeInTheDocument();
    });

    it('shows on a console game, which has no Steam reviews', () => {
      render(<GameCardInfo name="Game" platform="Switch" criticScore={93} criticCount={9} />);

      expect(screen.getByText(shown({ critic_score: 93, critic_count: 9 }))).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Critic score: 93');
      expect(screen.getByRole('tooltip')).not.toHaveTextContent('Steam');
    });
  });

  describe('steam review score', () => {
    it('should show the percent positive, the way Steam does', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={85} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should rate a Steam-only game from its Steam score, with the Steam label and review count on hover', () => {
      render(<GameCardInfo appId={1} name="Game" steamReviewScore={90} steamReviewCount={5000} />);

      expect(
        screen.getByText(shown({ steam_review_score: 90, steam_review_count: 5000 })),
      ).toBeInTheDocument();
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

    it("should show just the hours when there's no last-played date", () => {
      // Steam games with private details, and console games with hours entered by hand.
      render(<GameCardInfo appId={null} name="Game" playtimeMinutes={600} />);

      expect(screen.getByRole('tooltip')).toHaveTextContent(/^10h played$/);
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
