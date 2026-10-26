import { render, screen } from '@testing-library/react';
import { CurrentlyPlaying } from '@/components/CurrentlyPlaying';

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

const createGame = (playtime_forever: number, main_story_hours = 20) => ({
  id: 570,
  app_id: 570,
  name: 'Dota 2',
  header_image: 'https://example.com/dota2.jpg',
  main_story_hours,
  playtime_forever,
});

const defaultCallbacks = {
  onFinish: jest.fn(),
  onDrop: jest.fn(),
  onCancel: jest.fn(),
  onMoveToQueue: jest.fn(),
};

describe('CurrentlyPlaying', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('button behavior', () => {
    it('should disable buttons when isLoading is true', () => {
      render(<CurrentlyPlaying game={createGame(0)} {...defaultCallbacks} isLoading />);

      expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Drop' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move to Backlog' })).toBeDisabled();
    });
  });

  describe('playtime progress — under 1 hour played', () => {
    it('should show only time to beat when playtime is 0', () => {
      render(<CurrentlyPlaying game={createGame(0, 20)} {...defaultCallbacks} />);

      expect(screen.getByText('20h')).toBeInTheDocument();
      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });

    it('should show only time to beat when playtime is under 60 minutes', () => {
      render(<CurrentlyPlaying game={createGame(59, 20)} {...defaultCallbacks} />);

      expect(screen.getByText('20h')).toBeInTheDocument();
      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });

    it('should show nothing when main_story_hours is 0', () => {
      render(<CurrentlyPlaying game={createGame(120, 0)} {...defaultCallbacks} />);

      expect(screen.queryByText(/to beat/)).not.toBeInTheDocument();
      expect(screen.queryByText(/played/)).not.toBeInTheDocument();
    });
  });

  describe('playtime progress — in progress (1h+ played, under estimate)', () => {
    it('should show "Xh played" and "Yh to beat" at exactly 1 hour', () => {
      render(<CurrentlyPlaying game={createGame(60, 20)} {...defaultCallbacks} />);

      expect(screen.getAllByText('1h played')[0]).toBeInTheDocument();
      expect(screen.getByText('~20h to beat')).toBeInTheDocument();
    });

    it('should show rounded hours played', () => {
      // 750 minutes = 12.5 hours → rounds to 13h
      render(<CurrentlyPlaying game={createGame(750, 20)} {...defaultCallbacks} />);

      expect(screen.getAllByText('13h played')[0]).toBeInTheDocument();
      expect(screen.getByText('~20h to beat')).toBeInTheDocument();
    });

    it('should render a progress bar', () => {
      render(<CurrentlyPlaying game={createGame(600, 20)} {...defaultCallbacks} />);

      // 600 min = 10h played / 20h to beat = 50%
      const bar = screen.getByRole('progressbar');
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveStyle({ width: '50%' });
    });

    it('should not show amber colour or past-estimate message', () => {
      render(<CurrentlyPlaying game={createGame(600, 20)} {...defaultCallbacks} />);

      expect(screen.queryByText(/past the/)).not.toBeInTheDocument();
    });
  });

  describe('playtime progress — over the estimate', () => {
    it('should show amber hours played when equal to estimate', () => {
      // 1200 min = 20h = exactly the 20h estimate
      render(<CurrentlyPlaying game={createGame(1200, 20)} {...defaultCallbacks} />);

      expect(screen.getAllByText('20h played')[0]).toBeInTheDocument();
      expect(screen.getByText(/past the ~20h estimate/)).toBeInTheDocument();
    });

    it('should show amber hours played when over estimate', () => {
      // 1800 min = 30h, estimate is 20h
      render(<CurrentlyPlaying game={createGame(1800, 20)} {...defaultCallbacks} />);

      expect(screen.getAllByText('30h played')[0]).toBeInTheDocument();
      expect(screen.getByText(/past the ~20h estimate/)).toBeInTheDocument();
    });

    it('should not render a progress bar when over estimate', () => {
      render(<CurrentlyPlaying game={createGame(1800, 20)} {...defaultCallbacks} />);

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should not show "Xh to beat" label when over estimate', () => {
      render(<CurrentlyPlaying game={createGame(1800, 20)} {...defaultCallbacks} />);

      expect(screen.queryByText('~20h to beat')).not.toBeInTheDocument();
    });
  });

  describe('last played', () => {
    it('shows when Steam says you last played', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60_000).toISOString();
      render(
        <CurrentlyPlaying
          game={{ ...createGame(600, 20), last_played_at: threeDaysAgo }}
          {...defaultCallbacks}
        />,
      );
      expect(screen.getAllByText('Last played 3 days ago')).toHaveLength(2);
    });

    it('shows nothing when Steam does not share it', () => {
      render(<CurrentlyPlaying game={createGame(600, 20)} {...defaultCallbacks} />);
      expect(screen.queryByText(/Last played/)).not.toBeInTheDocument();
    });
  });
});
