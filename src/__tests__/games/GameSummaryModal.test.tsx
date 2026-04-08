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

  describe('stat blocks', () => {
    it('should render Steam hours when playtime > 0', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1440} />);

      expect(screen.getByText('24h of playtime')).toBeInTheDocument();
    });

    it('should always render "of playtime" label alongside hours', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1440} />);

      expect(screen.getByText(/of playtime/)).toBeInTheDocument();
    });

    it('should round Steam hours to 1 decimal', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={90} />); // 1.5h

      expect(screen.getByText('1.5h of playtime')).toBeInTheDocument();
    });

    it('should not render playtime row when playtime is 0', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={0} />);

      expect(screen.queryByTestId('estimate-text')).not.toBeInTheDocument();
    });

    it('should render games finished count', () => {
      render(<GameSummaryModal {...defaultProps} gamesFinished={3} totalGames={15} />);

      expect(screen.getByText('3/15')).toBeInTheDocument();
      expect(screen.getByText('games finished')).toBeInTheDocument();
    });

    it('should not render games finished when totalGames is 0', () => {
      render(<GameSummaryModal {...defaultProps} totalGames={0} />);

      expect(screen.queryByText('games finished')).not.toBeInTheDocument();
    });

    it('should render backlog hours removed when provided', () => {
      render(<GameSummaryModal {...defaultProps} backlogHoursRemoved={20} />);

      expect(screen.getByText('-20h')).toBeInTheDocument();
      expect(screen.getByText('from backlog')).toBeInTheDocument();
    });

    it('should not render backlog hours when null', () => {
      render(<GameSummaryModal {...defaultProps} backlogHoursRemoved={null} />);

      expect(screen.queryByText('from backlog')).not.toBeInTheDocument();
    });
  });

  describe('estimate comparison', () => {
    it('should show over-estimate text when played more than estimate', () => {
      // 24h played vs 20h estimate → 4h over (+20%)
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1440} mainStoryHours={20} />);

      const el = screen.getByTestId('estimate-text');
      expect(el).toHaveTextContent(/over/i);
      expect(el).toHaveTextContent('20h');
    });

    it('should show under-estimate text when played less than estimate', () => {
      // 10h played vs 20h estimate → 10h under
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={600} mainStoryHours={20} />);

      const el = screen.getByTestId('estimate-text');
      expect(el).toHaveTextContent(/under/i);
      expect(el).toHaveTextContent('20h');
    });

    it('should show "Right on" text when within 0.5h of estimate', () => {
      // 20.2h played vs 20h estimate — within 0.5h
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1212} mainStoryHours={20} />);

      expect(screen.getByTestId('estimate-text')).toHaveTextContent(/right on/i);
    });

    it('should not show over/under text when mainStoryHours is null', () => {
      render(<GameSummaryModal {...defaultProps} mainStoryHours={null} />);

      const el = screen.getByTestId('estimate-text');
      expect(el).not.toHaveTextContent(/over|under|right on/i);
    });

    it('should not show estimate text when playtime is 0', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={0} mainStoryHours={20} />);

      expect(screen.queryByTestId('estimate-text')).not.toBeInTheDocument();
    });
  });

  describe('rating', () => {
    it('should show rating when provided', () => {
      render(<GameSummaryModal {...defaultProps} rating={9} />);

      expect(screen.getByText('You rated it')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.getByText('/ 10')).toBeInTheDocument();
    });

    it('should not show rating when null', () => {
      render(<GameSummaryModal {...defaultProps} rating={null} />);

      expect(screen.queryByText('You rated it')).not.toBeInTheDocument();
      expect(screen.queryByText('/ 10')).not.toBeInTheDocument();
    });

    it('should show rating of 0', () => {
      render(<GameSummaryModal {...defaultProps} rating={0} />);

      expect(screen.getByText('You rated it')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('/ 10')).toBeInTheDocument();
    });
  });

  describe('next up', () => {
    it('should show next up when provided', () => {
      render(<GameSummaryModal {...defaultProps} nextGame="Hollow Knight" />);

      expect(screen.getByText('Next up:')).toBeInTheDocument();
      expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
    });

    it('should not show next up when null', () => {
      render(<GameSummaryModal {...defaultProps} nextGame={null} />);

      expect(screen.queryByText('Next up:')).not.toBeInTheDocument();
    });
  });
});
