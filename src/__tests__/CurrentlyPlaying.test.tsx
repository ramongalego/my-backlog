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

      expect(screen.getByText('1h played')).toBeInTheDocument();
      expect(screen.getByText('~20h to beat')).toBeInTheDocument();
    });

    it('should show rounded hours played', () => {
      // 750 minutes = 12.5 hours → rounds to 13h
      render(<CurrentlyPlaying game={createGame(750, 20)} {...defaultCallbacks} />);

      expect(screen.getByText('13h played')).toBeInTheDocument();
      expect(screen.getByText('~20h to beat')).toBeInTheDocument();
    });

    it('should render a progress bar', () => {
      render(<CurrentlyPlaying game={createGame(600, 20)} {...defaultCallbacks} />);

      // 600 min = 10h played / 20h to beat = 50%
      const bar = document.querySelector('.bg-sky-500');
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

      expect(screen.getByText('20h played')).toBeInTheDocument();
      expect(screen.getByText(/past the ~20h estimate/)).toBeInTheDocument();
    });

    it('should show amber hours played when over estimate', () => {
      // 1800 min = 30h, estimate is 20h
      render(<CurrentlyPlaying game={createGame(1800, 20)} {...defaultCallbacks} />);

      expect(screen.getByText('30h played')).toBeInTheDocument();
      expect(screen.getByText(/past the ~20h estimate/)).toBeInTheDocument();
    });

    it('should not render a progress bar when over estimate', () => {
      render(<CurrentlyPlaying game={createGame(1800, 20)} {...defaultCallbacks} />);

      expect(document.querySelector('.bg-sky-500')).not.toBeInTheDocument();
    });

    it('should not show "Xh to beat" label when over estimate', () => {
      render(<CurrentlyPlaying game={createGame(1800, 20)} {...defaultCallbacks} />);

      expect(screen.queryByText('~20h to beat')).not.toBeInTheDocument();
    });
  });
});
