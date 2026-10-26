import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { GameCarousel } from '@/components/GameCarousel';
import { isOnScreen, loopCopies, wrap } from '@/lib/carousel-loop';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    alt,
    fill,
    priority,
    ...props
  }: {
    alt: string;
    fill?: boolean;
    priority?: boolean;
    [key: string]: unknown;
  }) {
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} data-fill={fill ? 'true' : undefined} {...props} />;
  },
}));

const makeGames = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    app_id: i + 1,
    name: `Game ${i + 1}`,
    header_image: null,
    main_story_hours: i + 2,
    playtime_forever: 0,
  }));

/** A mouse on a wide screen (loop) or a phone (scroller), and reduced motion. */
function mockScreen({ loop, reducedMotion = false }: { loop: boolean; reducedMotion?: boolean }) {
  window.matchMedia = jest.fn((query: string) => ({
    matches: query.includes('reduced-motion') ? reducedMotion : loop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

// Cards a user can see and reach; off-screen copies are aria-hidden.
const visibleNames = () =>
  screen
    .getAllByRole('button', { name: /open details for/i })
    .map((b) => b.getAttribute('aria-label')!.replace('Open details for ', ''));

const track = (title: string) =>
  screen.getByRole('region', { name: title }).querySelector('[style*="translateX"]') as HTMLElement;

describe('loop arithmetic', () => {
  it('wraps indexes in both directions', () => {
    expect(wrap(7, 5)).toBe(2);
    expect(wrap(-1, 5)).toBe(4);
    expect(wrap(0, 5)).toBe(0);
  });

  it('renders enough copies that a slide never runs out of cards', () => {
    expect(loopCopies(15, 5)).toEqual({ before: 1, after: 1 });
    // Barely more games than fit: more copies are needed on the right.
    expect(loopCopies(6, 5)).toEqual({ before: 1, after: 2 });
    expect(loopCopies(4, 3)).toEqual({ before: 1, after: 2 });
    // A page of 5 plus a peeking sixth card, with only 7 games.
    expect(loopCopies(7, 5, 6)).toEqual({ before: 1, after: 2 });
    expect(loopCopies(15, 5, 6)).toEqual({ before: 1, after: 1 });
  });

  it('knows which positions are on screen', () => {
    expect(isOnScreen(5, 5, 4)).toBe(true);
    expect(isOnScreen(8, 5, 4)).toBe(true);
    expect(isOnScreen(9, 5, 4)).toBe(false);
    expect(isOnScreen(4, 5, 4)).toBe(false);
  });
});

describe('GameCarousel', () => {
  it('renders nothing with fewer than 3 games', () => {
    mockScreen({ loop: true });
    const { container } = render(<GameCarousel title="Few" games={makeGames(2)} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens the details of the card you click', () => {
    mockScreen({ loop: false });
    const onOpenDetail = jest.fn();
    const games = makeGames(3);
    render(<GameCarousel title="Test" games={games} onOpenDetail={onOpenDetail} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open details for Game 2' }));
    expect(onOpenDetail).toHaveBeenCalledWith(games[1]);
  });

  describe('on phones and touch screens', () => {
    it('is a plain swipeable row with no arrows', () => {
      mockScreen({ loop: false });
      render(<GameCarousel title="Swipe" games={makeGames(8)} />);

      expect(visibleNames()).toHaveLength(8);
      expect(screen.queryByRole('button', { name: /show (more|previous) games/i })).toBeNull();
    });
  });

  describe('with a mouse on a wide screen', () => {
    beforeEach(() => mockScreen({ loop: true }));

    it('shows a page of games, with only the right arrow to start with', () => {
      render(<GameCarousel title="Loop" games={makeGames(6)} />);

      expect(visibleNames()).toEqual(['Game 1', 'Game 2', 'Game 3', 'Game 4']);
      expect(screen.getByRole('button', { name: 'Show more games' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show previous games' })).toBeNull();
    });

    it('slides a page at a time and loops back to the first games after the last', () => {
      render(<GameCarousel title="Loop" games={makeGames(6)} />);
      const next = screen.getByRole('button', { name: 'Show more games' });

      fireEvent.click(next);
      fireEvent.transitionEnd(track('Loop'));
      expect(visibleNames()).toEqual(['Game 5', 'Game 6', 'Game 1', 'Game 2']);

      fireEvent.click(next);
      fireEvent.transitionEnd(track('Loop'));
      expect(visibleNames()).toEqual(['Game 3', 'Game 4', 'Game 5', 'Game 6']);
    });

    it('goes back the other way, past the start', () => {
      render(<GameCarousel title="Loop" games={makeGames(6)} />);
      fireEvent.click(screen.getByRole('button', { name: 'Show more games' }));
      fireEvent.transitionEnd(track('Loop'));

      const previous = screen.getByRole('button', { name: 'Show previous games' });
      fireEvent.click(previous);
      fireEvent.transitionEnd(track('Loop'));
      expect(visibleNames()).toEqual(['Game 1', 'Game 2', 'Game 3', 'Game 4']);

      fireEvent.click(previous);
      fireEvent.transitionEnd(track('Loop'));
      expect(visibleNames()).toEqual(['Game 3', 'Game 4', 'Game 5', 'Game 6']);
    });

    it('ignores clicks while a slide is still moving', () => {
      render(<GameCarousel title="Loop" games={makeGames(9)} />);
      const next = screen.getByRole('button', { name: 'Show more games' });

      fireEvent.click(next);
      fireEvent.click(next);
      fireEvent.transitionEnd(track('Loop'));
      expect(visibleNames()).toEqual(['Game 5', 'Game 6', 'Game 7', 'Game 8']);
    });

    it('finishes the slide even if the browser never reports the end of the transition', () => {
      jest.useFakeTimers();
      try {
        render(<GameCarousel title="Loop" games={makeGames(6)} />);
        fireEvent.click(screen.getByRole('button', { name: 'Show more games' }));
        act(() => jest.advanceTimersByTime(1000));
        expect(visibleNames()).toEqual(['Game 5', 'Game 6', 'Game 1', 'Game 2']);
      } finally {
        jest.useRealTimers();
      }
    });

    it('moves without animating when the user prefers reduced motion', () => {
      mockScreen({ loop: true, reducedMotion: true });
      render(<GameCarousel title="Loop" games={makeGames(6)} />);

      fireEvent.click(screen.getByRole('button', { name: 'Show more games' }));
      expect(visibleNames()).toEqual(['Game 5', 'Game 6', 'Game 1', 'Game 2']);
      expect(track('Loop').style.transition).toBe('none');
    });

    it('keeps off-screen cards out of reach of the keyboard', () => {
      render(<GameCarousel title="Loop" games={makeGames(6)} />);
      const region = screen.getByRole('region', { name: 'Loop' });
      const inertCards = region.querySelectorAll('[inert]');
      // 4 copies of 6 games rendered, 4 on screen.
      expect(inertCards).toHaveLength(6 * 4 - 4);
      expect(within(region).getAllByRole('button', { name: /open details/i })).toHaveLength(4);
    });

    it('makes nothing reachable while a slide is moving', () => {
      render(<GameCarousel title="Loop" games={makeGames(6)} />);
      fireEvent.click(screen.getByRole('button', { name: 'Show more games' }));
      expect(screen.queryAllByRole('button', { name: /open details/i })).toHaveLength(0);

      fireEvent.transitionEnd(track('Loop'));
      expect(screen.getAllByRole('button', { name: /open details/i })).toHaveLength(4);
    });

    it('puts the row back if the browser scrolls it to show a focused card', () => {
      render(<GameCarousel title="Loop" games={makeGames(6)} />);
      const clip = track('Loop').parentElement!;
      clip.scrollLeft = 500;
      fireEvent.scroll(clip);
      expect(clip.scrollLeft).toBe(0);
    });

    it("doesn't loop when every game already fits", () => {
      render(<GameCarousel title="Short" games={makeGames(3)} />);
      expect(visibleNames()).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Show more games' })).toBeNull();
    });
  });
});
