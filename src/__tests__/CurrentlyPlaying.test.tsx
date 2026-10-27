import { fireEvent, render, screen } from '@testing-library/react';
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

  describe('playtime progress — just picked', () => {
    it('shows the progress bar from 0h, with no rating or Deck rating', () => {
      render(
        <CurrentlyPlaying
          game={{ ...createGame(0, 20), steam_review_score: 95, deck_compat: 3 } as never}
          {...defaultCallbacks}
        />,
      );

      expect(screen.getAllByText('0h played')[0]).toBeInTheDocument();
      expect(screen.getByText('~20h to beat')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveStyle({ width: '0%' });
      expect(screen.queryByText('95%')).not.toBeInTheDocument();
      expect(screen.queryByText('Deck')).not.toBeInTheDocument();
    });

    it('shows just the hours played when there is no time to beat', () => {
      render(<CurrentlyPlaying game={createGame(120, 0)} {...defaultCallbacks} />);

      expect(screen.getAllByText('2h played')[0]).toBeInTheDocument();
      expect(screen.queryByText(/to beat/)).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
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

  describe('hours played on a console', () => {
    const consoleGame = (playtime_forever: number, main_story_hours = 20) => ({
      ...createGame(playtime_forever, main_story_hours),
      app_id: null,
      source: 'manual',
      platform: 'PS5',
      name: 'Persona 3 Reload',
    });

    it('shows the hours even before the first hour, and with no time to beat', () => {
      const onSaveHours = jest.fn();
      const { rerender } = render(
        <CurrentlyPlaying game={consoleGame(0)} {...defaultCallbacks} onSaveHours={onSaveHours} />,
      );
      expect(screen.getByRole('button', { name: /Edit hours played on PS5/ })).toHaveTextContent(
        '0h played',
      );
      rerender(
        <CurrentlyPlaying
          game={consoleGame(90, 0)}
          {...defaultCallbacks}
          onSaveHours={onSaveHours}
        />,
      );
      expect(screen.getByRole('button', { name: /Edit hours played on PS5/ })).toHaveTextContent(
        '2h played',
      );
    });

    it('edits them in place: Enter saves, Escape cancels, nonsense is refused', () => {
      const onSaveHours = jest.fn();
      render(
        <CurrentlyPlaying
          game={consoleGame(150)}
          {...defaultCallbacks}
          onSaveHours={onSaveHours}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Edit hours played/ }));
      const field = screen.getByRole('spinbutton', { name: 'Hours played on PS5' });
      // Tenths, so an edit doesn't round 2.5h away.
      expect(field).toHaveValue(2.5);

      fireEvent.keyDown(field, { key: 'Escape' });
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(onSaveHours).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Edit hours played/ }));
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true');

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
      fireEvent.submit(screen.getByRole('spinbutton'));
      expect(onSaveHours).toHaveBeenCalledWith(12);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it("keeps a Steam game's hours read-only", () => {
      render(<CurrentlyPlaying game={createGame(150)} {...defaultCallbacks} />);
      expect(screen.getAllByText('3h played').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /Edit hours played/ })).not.toBeInTheDocument();
    });
  });
});
