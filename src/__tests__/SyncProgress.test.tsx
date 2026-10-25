import { render, screen } from '@testing-library/react';
import { SyncProgress } from '@/components/SyncProgress';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    alt,
    fill,
    unoptimized,
    ...props
  }: {
    alt: string;
    fill?: boolean;
    unoptimized?: boolean;
    [key: string]: unknown;
  }) {
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} data-fill={fill ? 'true' : undefined} {...props} />;
  },
}));

const mockGames = [
  { app_id: 1, name: 'Game One', type: 'game', categories: ['Single-player'] },
  { app_id: 2, name: 'Game Two', type: 'game', categories: ['Single-player'] },
  { app_id: 3, name: 'Game Three', type: 'game', categories: ['Single-player'] },
];

describe('SyncProgress', () => {
  describe('progress display', () => {
    it('should show progress text', () => {
      render(<SyncProgress progress={{ current: 5, total: 10 }} games={mockGames} />);

      expect(screen.getByText(/Analyzing game 5 of 10/)).toBeInTheDocument();
    });

    it('should render progress bar with correct aria attributes', () => {
      render(<SyncProgress progress={{ current: 3, total: 10 }} games={mockGames} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '3');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '10');
    });

    it('should show 0% width when no progress', () => {
      render(<SyncProgress progress={{ current: 0, total: 10 }} games={mockGames} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should show 50% width when half done', () => {
      render(<SyncProgress progress={{ current: 5, total: 10 }} games={mockGames} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should handle edge case of zero total', () => {
      render(<SyncProgress progress={{ current: 0, total: 0 }} games={[]} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });
  });

  describe('current game display', () => {
    it('should show current game name when syncing', () => {
      render(<SyncProgress progress={{ current: 2, total: 3 }} games={mockGames} />);

      // current - 1 = index 1 = "Game Two"
      expect(screen.getByText('Game Two')).toBeInTheDocument();
    });

    it('shows the stored cover once it has loaded', () => {
      // jsdom never loads images, so finish every load straight away.
      const RealImage = window.Image;
      window.Image = class {
        onload: (() => void) | null = null;
        set src(_: string) {
          this.onload?.();
        }
      } as unknown as typeof Image;
      try {
        const games = mockGames.map((g) => ({
          ...g,
          header_image: `https://cdn.test/${g.app_id}.jpg`,
        }));
        render(<SyncProgress progress={{ current: 1, total: 3 }} games={games} />);
        expect(screen.getByAltText('Game One')).toHaveAttribute('src', 'https://cdn.test/1.jpg');
      } finally {
        window.Image = RealImage;
      }
    });

    it('shows just the name until a cover has loaded', () => {
      render(<SyncProgress progress={{ current: 1, total: 3 }} games={mockGames} />);
      expect(screen.getByText('Game One')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should not show game card when progress.current is 0', () => {
      render(<SyncProgress progress={{ current: 0, total: 3 }} games={mockGames} />);

      expect(screen.queryByText('Game One')).not.toBeInTheDocument();
    });

    it('should not show game card when games array is empty', () => {
      render(<SyncProgress progress={{ current: 1, total: 3 }} games={[]} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });
});
