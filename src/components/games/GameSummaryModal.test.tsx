import { render, screen } from '@testing-library/react';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';

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

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  gameName: 'Hades',
  headerImage: 'https://example.com/hades.jpg',
  playtimeMinutes: 1440, // 24h
  mainStoryHours: 20,
  rating: 9,
  gamesFinished: 3,
  totalGames: 15,
  backlogHoursRemoved: 20,
  nextGame: 'Hollow Knight',
};

describe('GameSummaryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('time played', () => {
    it('says how long it took, rounded to a decimal', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={90} mainStoryHours={null} />);
      expect(screen.getByTestId('estimate-text')).toHaveTextContent(
        'You finished it in 1.5 hours.',
      );
    });

    it('leaves the sentence out with no hours played (a console game without hours)', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={0} />);
      expect(screen.queryByTestId('estimate-text')).not.toBeInTheDocument();
    });
  });

  describe('estimate comparison', () => {
    it('says how far over the estimate it went', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1440} mainStoryHours={20} />);
      expect(screen.getByTestId('estimate-text')).toHaveTextContent(
        'You finished it in 24 hours, 4 hours over the ~20h estimate.',
      );
    });

    it('says how far under the estimate it came', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={600} mainStoryHours={20} />);
      expect(screen.getByTestId('estimate-text')).toHaveTextContent(
        '10 hours under the ~20h estimate',
      );
    });

    it('says "right on" within half an hour of the estimate', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1212} mainStoryHours={20} />);
      expect(screen.getByTestId('estimate-text')).toHaveTextContent(/right on the ~20h estimate/);
    });

    it('leaves the comparison out without an estimate', () => {
      render(<GameSummaryModal {...defaultProps} mainStoryHours={null} />);
      expect(screen.getByTestId('estimate-text')).not.toHaveTextContent(/over|under|right on/i);
    });
  });

  describe('what it did to the library', () => {
    it('counts the games finished and the hours off the backlog', () => {
      render(<GameSummaryModal {...defaultProps} gamesFinished={3} totalGames={15} />);
      expect(
        screen.getByText(/That's 3 of your 15 games finished, and 20 hours off your backlog./),
      ).toBeInTheDocument();
    });

    it('leaves out what it has no figure for', () => {
      render(<GameSummaryModal {...defaultProps} totalGames={0} backlogHoursRemoved={null} />);
      expect(screen.queryByText(/That's/)).not.toBeInTheDocument();
    });
  });

  describe('this finish', () => {
    const year = new Date().getFullYear();

    it('places it in the year and says how long it took from starting it', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          startedAt={`${year}-01-01T20:00:00Z`}
          finishedAt={`${year}-01-22`}
          finishedThisYear={5}
        />,
      );
      expect(
        screen.getByText(/It's your 5th game finished this year, played over 3 weeks./),
      ).toBeInTheDocument();
    });

    it("doesn't place a backdated finish in this year", () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          finishedAt={`${year - 1}-12-30`}
          finishedThisYear={5}
        />,
      );
      expect(screen.queryByText(/this year/)).not.toBeInTheDocument();
    });

    it('says nothing about a same-day finish, likely catching up on an old game', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          startedAt={`${year}-03-02T09:00:00Z`}
          finishedAt={`${year}-03-02`}
        />,
      );
      expect(screen.queryByText(/played it over/)).not.toBeInTheDocument();
    });
  });

  describe('rating', () => {
    it('shows the rating as everywhere else', () => {
      render(<GameSummaryModal {...defaultProps} rating={9} />);
      expect(screen.getByText('9/10')).toBeInTheDocument();
    });

    it('shows a rating of 0', () => {
      render(<GameSummaryModal {...defaultProps} rating={0} />);
      expect(screen.getByText('0/10')).toBeInTheDocument();
    });

    it('leaves it out without one', () => {
      render(<GameSummaryModal {...defaultProps} rating={null} />);
      expect(screen.queryByText('/10', { exact: false })).not.toBeInTheDocument();
    });
  });

  describe('next up', () => {
    it('should show next up when provided', () => {
      render(<GameSummaryModal {...defaultProps} nextGame="Hollow Knight" />);

      expect(screen.getByText(/Next up:/)).toBeInTheDocument();
      expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
    });

    it('should not show next up when null', () => {
      render(<GameSummaryModal {...defaultProps} nextGame={null} />);

      expect(screen.queryByText(/Next up:/)).not.toBeInTheDocument();
    });
  });
});
