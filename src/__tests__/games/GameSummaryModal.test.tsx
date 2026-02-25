import { render, screen, fireEvent } from '@testing-library/react';
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
  startedAt: '2024-06-01T10:00:00.000Z',
  finishedAt: '2024-06-15',
  playtimeMinutes: 1440, // 24h
  mainStoryHours: 20,
  rating: 9,
};

describe('GameSummaryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render game name', () => {
      render(<GameSummaryModal {...defaultProps} />);

      expect(screen.getByText('Hades')).toBeInTheDocument();
    });

    it('should render "You finished it!" tagline', () => {
      render(<GameSummaryModal {...defaultProps} />);

      expect(screen.getByText(/you finished it/i)).toBeInTheDocument();
    });

    it('should render game image when provided', () => {
      render(<GameSummaryModal {...defaultProps} />);

      expect(screen.getByAltText('Hades')).toHaveAttribute('src', 'https://example.com/hades.jpg');
    });

    it('should render placeholder when no image', () => {
      render(<GameSummaryModal {...defaultProps} headerImage={null} />);

      expect(screen.queryByAltText('Hades')).not.toBeInTheDocument();
    });

    it('should render "On to the next one" button', () => {
      render(<GameSummaryModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'On to the next one' })).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<GameSummaryModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Hades')).not.toBeInTheDocument();
    });
  });

  describe('stat blocks', () => {
    it('should render Steam hours when playtime > 0', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1440} />);

      expect(screen.getByText('24h')).toBeInTheDocument();
      expect(screen.getByText('of playtime')).toBeInTheDocument();
    });

    it('should round Steam hours to 1 decimal', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={90} />); // 1.5h

      expect(screen.getByText('1.5h')).toBeInTheDocument();
    });

    it('should render days played when startedAt and finishedAt are provided', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          startedAt="2024-06-01T10:00:00.000Z"
          finishedAt="2024-06-15"
        />,
      );

      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText('days played')).toBeInTheDocument();
    });

    it('should show "day played" (singular) when daysPlayed is 1', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          startedAt="2024-06-15T10:00:00.000Z"
          finishedAt="2024-06-15"
        />,
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('day played')).toBeInTheDocument();
    });

    it('should render hours per day when daysPlayed > 1', () => {
      // 14 days, 24h → 1.7h/day
      render(
        <GameSummaryModal
          {...defaultProps}
          startedAt="2024-06-01T10:00:00.000Z"
          finishedAt="2024-06-15"
          playtimeMinutes={1440}
        />,
      );

      expect(screen.getByText('1.7h')).toBeInTheDocument();
      expect(screen.getByText('avg per day')).toBeInTheDocument();
    });

    it('should not show hours per day when daysPlayed is 1', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          startedAt="2024-06-15T10:00:00.000Z"
          finishedAt="2024-06-15"
        />,
      );

      expect(screen.queryByText('avg per day')).not.toBeInTheDocument();
    });

    it('should not render days when startedAt is null', () => {
      render(<GameSummaryModal {...defaultProps} startedAt={null} />);

      expect(screen.queryByText('days played')).not.toBeInTheDocument();
      expect(screen.queryByText('avg per day')).not.toBeInTheDocument();
    });

    it('should not render days when finishedAt is empty string', () => {
      render(<GameSummaryModal {...defaultProps} finishedAt="" />);

      expect(screen.queryByText('days played')).not.toBeInTheDocument();
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

    it('should not show estimate text when mainStoryHours is null', () => {
      render(<GameSummaryModal {...defaultProps} mainStoryHours={null} />);

      expect(screen.queryByTestId('estimate-text')).not.toBeInTheDocument();
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

  describe('library progress', () => {
    it('should not show library progress section', () => {
      render(<GameSummaryModal {...defaultProps} />);

      expect(screen.queryByText(/games finished/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('backlog-hours')).not.toBeInTheDocument();
    });
  });

  describe('onClose callback', () => {
    it('should call onClose when "On to the next one" is clicked', () => {
      render(<GameSummaryModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'On to the next one' }));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
