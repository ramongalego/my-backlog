import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { createSharePage } from '@/lib/client/share';

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
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/lib/client/share', () => ({ createSharePage: jest.fn() }));

const mockCreateSharePage = jest.mocked(createSharePage);

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  gameId: 7,
  gameName: 'Hades',
  headerImage: 'https://example.com/hades.jpg',
  playtimeMinutes: 1440, // 24h
  mainStoryHours: 20,
  rating: 9,
  gamesFinished: 3,
  totalGames: 15,
  nextGame: 'Hollow Knight',
};

const year = new Date().getFullYear();

/** The time bar's filled parts: up to the estimate, then anything past it. */
function timeBar() {
  const bar = screen.getByTestId('time-played').querySelector('[aria-hidden="true"]');
  return Array.from(bar!.firstElementChild!.children) as HTMLElement[];
}

describe('GameSummaryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('time played', () => {
    it('says how long it took, rounded to a decimal', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={90} mainStoryHours={null} />);
      expect(screen.getByTestId('time-played')).toHaveTextContent('You finished it in 1.5 hours.');
    });

    it('adds how long it took from starting it', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          mainStoryHours={null}
          startedAt={`${year}-01-01T20:00:00Z`}
          finishedAt={`${year}-01-22`}
        />,
      );
      expect(screen.getByTestId('time-played')).toHaveTextContent(
        'You finished it in 24 hours over 3 weeks.',
      );
    });

    it('says nothing about a same-day finish, likely catching up on an old game', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          mainStoryHours={null}
          startedAt={`${year}-03-02T09:00:00Z`}
          finishedAt={`${year}-03-02`}
        />,
      );
      expect(screen.getByTestId('time-played')).toHaveTextContent('You finished it in 24 hours.');
    });

    it('leaves the sentence out with no hours played (a console game without hours)', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={0} />);
      expect(screen.queryByTestId('time-played')).not.toBeInTheDocument();
    });
  });

  describe('against the estimate', () => {
    it('says how far over the estimate it went, with the part past it drawn apart', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1440} mainStoryHours={20} />);
      expect(screen.getByTestId('time-played')).toHaveTextContent('4 hours over the ~20h estimate');
      const [toEstimate, past] = timeBar();
      // 20 of the 24 hours played.
      expect(parseFloat(toEstimate.style.width)).toBeCloseTo(83.33, 1);
      expect(past).toBeInTheDocument();
    });

    it('says how far under the estimate it came, the bar stopping short', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={600} mainStoryHours={20} />);
      expect(screen.getByTestId('time-played')).toHaveTextContent(
        '10 hours under the ~20h estimate',
      );
      const parts = timeBar();
      expect(parts).toHaveLength(1);
      expect(parts[0].style.width).toBe('50%');
    });

    it('says "right on" within half an hour of the estimate', () => {
      render(<GameSummaryModal {...defaultProps} playtimeMinutes={1212} mainStoryHours={20} />);
      expect(screen.getByTestId('time-played')).toHaveTextContent(/Right on the ~20h estimate/);
    });

    it('leaves the comparison and its bar out without an estimate', () => {
      render(<GameSummaryModal {...defaultProps} mainStoryHours={null} />);
      const time = screen.getByTestId('time-played');
      expect(time).not.toHaveTextContent(/over|under|right on/i);
      expect(time.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    });
  });

  describe('the library', () => {
    it('counts the games finished', () => {
      render(<GameSummaryModal {...defaultProps} gamesFinished={3} totalGames={15} />);
      expect(screen.getByTestId('library-progress')).toHaveTextContent('3 of 15 games finished');
    });

    it('draws a spine for every game, the finished ones filled and this one apart', () => {
      render(<GameSummaryModal {...defaultProps} gamesFinished={3} totalGames={15} />);
      const spines = Array.from(
        screen.getByTestId('library-progress').querySelectorAll('[aria-hidden="true"] > span'),
      );
      expect(spines).toHaveLength(15);
      expect(spines.filter((s) => s.className.includes('bg-emerald-500'))).toHaveLength(2);
      expect(spines.filter((s) => s.className.includes('bg-emerald-300'))).toHaveLength(1);
      // The game just finished comes right after the ones finished before it.
      expect(spines[2].className).toContain('bg-emerald-300');
    });

    it('draws a library too big for spines as one bar', () => {
      render(<GameSummaryModal {...defaultProps} gamesFinished={300} totalGames={2000} />);
      const shelf = screen.getByTestId('library-progress');
      expect(shelf).toHaveTextContent('300 of 2000 games finished');
      expect(shelf.querySelectorAll('span[class*="h-3.5"]')).toHaveLength(0);
      const [before, thisGame] = Array.from(
        shelf.querySelector('[aria-hidden="true"]')!.firstElementChild!.children,
      ) as HTMLElement[];
      expect(before.style.width).toBe('14.95%');
      expect(thisGame.style.width).toBe('0.05%');
    });

    it('leaves it out with no figure for it', () => {
      render(<GameSummaryModal {...defaultProps} totalGames={0} gamesFinished={0} />);
      expect(screen.queryByTestId('library-progress')).not.toBeInTheDocument();
    });

    it('places the finish in the year', () => {
      render(
        <GameSummaryModal {...defaultProps} finishedAt={`${year}-01-22`} finishedThisYear={5} />,
      );
      expect(screen.getByTestId('library-progress')).toHaveTextContent('Your 5th this year');
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
    it('names the next game', () => {
      render(<GameSummaryModal {...defaultProps} nextGame="Hollow Knight" />);
      expect(screen.getByText(/Next up/)).toBeInTheDocument();
      expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
    });

    it('shows its art beside the name when there is some', () => {
      render(
        <GameSummaryModal
          {...defaultProps}
          nextGame="Hollow Knight"
          nextGameImage="https://example.com/hk.jpg"
        />,
      );
      expect(document.querySelector('img[src="https://example.com/hk.jpg"]')).toBeInTheDocument();
      expect(screen.getByText('Hollow Knight')).toBeInTheDocument();
    });

    it('is left out with nothing queued', () => {
      render(<GameSummaryModal {...defaultProps} nextGame={null} />);
      expect(screen.queryByText(/Next up/)).not.toBeInTheDocument();
    });
  });

  describe('sharing', () => {
    const share = () => fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    it('says that sharing makes a public page', () => {
      render(<GameSummaryModal {...defaultProps} />);
      expect(screen.getByText('Makes a public page with this summary.')).toBeInTheDocument();
    });

    it('offers the places to share to once the page is made, with focus on Copy link', async () => {
      mockCreateSharePage.mockResolvedValue('/share/completion/abc');
      render(<GameSummaryModal {...defaultProps} />);
      share();

      const copy = await screen.findByRole('button', { name: 'Copy link' });
      expect(mockCreateSharePage).toHaveBeenCalledWith(7);
      expect(copy).toHaveFocus();
      expect(screen.getByRole('button', { name: /Reddit/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Twitter/ })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Share link ready');
      expect(screen.queryByText('Makes a public page with this summary.')).not.toBeInTheDocument();
    });

    it('copies the link and says so', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      mockCreateSharePage.mockResolvedValue('/share/completion/abc');
      render(<GameSummaryModal {...defaultProps} />);
      share();
      fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

      expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/completion/abc`);
      expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    });

    it("says so when the link can't be copied", async () => {
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      });
      mockCreateSharePage.mockResolvedValue('/share/completion/abc');
      render(<GameSummaryModal {...defaultProps} />);
      share();
      fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't copy the link."));
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    });

    it("says so when the page can't be made, and offers Share again", async () => {
      mockCreateSharePage.mockRejectedValue(new Error('nope'));
      render(<GameSummaryModal {...defaultProps} />);
      share();

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Couldn't create the share link. Try again."),
      );
      const again = screen.getByRole('button', { name: 'Share' });
      expect(again).toBeEnabled();
      expect(within(again).getByText('Share')).toBeInTheDocument();
    });
  });
});
