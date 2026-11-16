import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { FavoritesPicker } from '@/components/profile/FavoritesPicker';
import { toggleFavorite } from '@/lib/account/favorites';
import { libraryGame as game } from '@/lib/account/test-games';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const rated = (id: number, name: string, rating: number) =>
  game({ id, name, status: 'finished', rating, finished_at: '2026-01-01T00:00:00+00:00' });

const library = [
  rated(1, 'Castlevania', 10),
  rated(2, 'Persona 5 Royal', 9),
  rated(3, 'Metaphor', 9),
  rated(4, 'Hades', 8),
  rated(7, 'Outer Wilds', 7),
  game({ id: 5, name: 'Celeste' }),
  game({ id: 6, name: 'Old Tool', status: 'hidden' }),
];

const onClose = jest.fn();
// The page's part: it keeps the picks, and hands back what they are after a click.
let picks: number[];
const onToggle = jest.fn((id: number) => (picks = toggleFavorite(picks, id)));

function open(pickedIds: number[] = []) {
  picks = pickedIds;
  const view = render(
    <FavoritesPicker games={library} pickedIds={picks} onToggle={onToggle} onClose={onClose} />,
  );
  /** Redraws with the picks as the page now has them. */
  const redraw = () =>
    view.rerender(
      <FavoritesPicker games={library} pickedIds={picks} onToggle={onToggle} onClose={onClose} />,
    );
  return { redraw };
}

const tiles = () => within(screen.getByRole('list', { name: 'Your games' })).getAllByRole('button');
const tile = (name: string | RegExp) =>
  within(screen.getByRole('list', { name: 'Your games' })).getByRole('button', { name });
const status = () => screen.getByRole('status');

// The grid's end coming into reach, which a test brings about by hand: jsdom
// lays nothing out, so nothing ever scrolls into view on its own.
let reachEnd: (() => void) | null = null;
const realObserver = globalThis.IntersectionObserver;
class ObserverInTest {
  constructor(private report: (entries: { isIntersecting: boolean }[]) => void) {}
  observe() {
    reachEnd = () => this.report([{ isIntersecting: true }]);
  }
  disconnect() {
    reachEnd = null;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  reachEnd = null;
  globalThis.IntersectionObserver = ObserverInTest as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  globalThis.IntersectionObserver = realObserver;
  delete (window as { matchMedia?: unknown }).matchMedia;
});

/** A mouse (fine pointer, hover) or a touchscreen, as the browser reports it. */
const withPointer = (fine: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: fine && query === '(hover: hover) and (pointer: fine)',
  })) as unknown as typeof window.matchMedia;
};

it('lists the library as art to pick from, highest rated first, without hidden games', () => {
  open();
  expect(screen.getByRole('dialog', { name: 'Favorite games' })).toBeInTheDocument();
  expect(tiles().map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
    '10/10 Castlevania',
    '9/10 Persona 5 Royal',
    '9/10 Metaphor',
    '8/10 Hades',
    '7/10 Outer Wilds',
    'Celeste',
  ]);
  expect(status()).toHaveTextContent('Pick up to 4');
});

it('marks the games already picked, and says how many places are left', () => {
  open([4, 1]);
  expect(tile(/Hades/)).toHaveAttribute('aria-pressed', 'true');
  expect(tile(/Castlevania/)).toHaveAttribute('aria-pressed', 'true');
  expect(tile(/Outer Wilds/)).toHaveAttribute('aria-pressed', 'false');
  expect(status()).toHaveTextContent('2 places left');
});

it('picks a game on and off, each change handed to the page as it is made', () => {
  const { redraw } = open([1]);
  fireEvent.click(tile(/Hades/));
  expect(onToggle).toHaveBeenLastCalledWith(4);
  redraw();
  expect(tile(/Hades/)).toHaveAttribute('aria-pressed', 'true');
  expect(status()).toHaveTextContent('2 places left');

  fireEvent.click(tile(/Castlevania/));
  redraw();
  expect(tile(/Castlevania/)).toHaveAttribute('aria-pressed', 'false');
  expect(status()).toHaveTextContent('3 places left');
  expect(onClose).not.toHaveBeenCalled();
});

it('says "1 place left" for one', () => {
  open([1, 2, 3]);
  expect(status()).toHaveTextContent('1 place left');
});

it("stays open when the last place is filled: closing is the player's to do", () => {
  const { redraw } = open([1, 2, 3]);
  fireEvent.click(tile(/Hades/));
  expect(picks).toEqual([1, 2, 3, 4]);
  expect(onClose).not.toHaveBeenCalled();
  redraw();
  expect(status()).toHaveTextContent('All 4 picked. Take one off to pick another.');
});

it('holds four: the rest are dimmed until one is taken off', () => {
  const { redraw } = open([1, 2, 3, 4]);
  expect(status()).toHaveTextContent('All 4 picked. Take one off to pick another.');
  expect(tile(/Outer Wilds/)).toHaveAttribute('aria-disabled', 'true');

  fireEvent.click(tile(/Outer Wilds/));
  expect(onToggle).not.toHaveBeenCalled();

  fireEvent.click(tile(/Metaphor/));
  redraw();
  expect(tile(/Outer Wilds/)).not.toHaveAttribute('aria-disabled');
});

it('searches the library by name', () => {
  open();
  const search = screen.getByRole('textbox', { name: 'Search your games' });
  fireEvent.change(search, { target: { value: 'pers' } });
  expect(tiles()).toHaveLength(1);

  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(
    screen.getByText('No games match “zzz”', { selector: 'p:not(.sr-only)' }),
  ).toBeInTheDocument();
});

it('starts in the search with a mouse, where typing straight away costs nothing', () => {
  withPointer(true);
  open();
  expect(screen.getByRole('textbox', { name: 'Search your games' })).toHaveAttribute(
    'data-autofocus',
  );
});

it("doesn't start in the search on a touchscreen: the keyboard would cover the games", () => {
  withPointer(false);
  open();
  expect(screen.getByRole('textbox', { name: 'Search your games' })).not.toHaveAttribute(
    'data-autofocus',
  );
});

it('gives a long name two lines, so two games of a series can be told apart', () => {
  open();
  expect(screen.getByText('Persona 5 Royal')).toHaveClass('line-clamp-2');
  expect(screen.getByText('Persona 5 Royal')).not.toHaveClass('truncate');
});

it('says so on closing when the place that opened it was filled', () => {
  const onOpenerGone = jest.fn();
  const Page = ({ place, picking }: { place: boolean; picking: boolean }) => (
    <>
      {place && <button>Add a favorite game</button>}
      {picking && (
        <FavoritesPicker
          games={library}
          pickedIds={[]}
          onToggle={onToggle}
          onClose={onClose}
          onOpenerGone={onOpenerGone}
        />
      )}
    </>
  );
  const view = render(<Page place picking={false} />);
  screen.getByRole('button', { name: 'Add a favorite game' }).focus();
  view.rerender(<Page place picking />);
  view.rerender(<Page place={false} picking />);
  view.rerender(<Page place={false} picking={false} />);
  expect(onOpenerGone).toHaveBeenCalledTimes(1);
});

it('says what a search found, since focus stays in the field', () => {
  open();
  const search = screen.getByRole('textbox', { name: 'Search your games' });
  const said = () => document.querySelector('[aria-live="polite"].sr-only');
  // Nothing to say until something is searched for.
  expect(said()).toBeEmptyDOMElement();

  fireEvent.change(search, { target: { value: 'pers' } });
  expect(said()).toHaveTextContent('1 game found');
  fireEvent.change(search, { target: { value: 'a' } });
  expect(said()).toHaveTextContent(/^\d games found$/);
  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(said()).toHaveTextContent('No games match “zzz”');
});

it('closes on Done', () => {
  open([1]);
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onToggle).not.toHaveBeenCalled();
});

describe('with a large library', () => {
  const big = Array.from({ length: 130 }, (_, i) => game({ id: i + 1, name: `Game ${i + 1}` }));
  const openBig = () =>
    render(<FavoritesPicker games={big} pickedIds={[]} onToggle={onToggle} onClose={onClose} />);
  const search = (text: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Search your games' }), {
      target: { value: text },
    });

  it('draws a first batch, and the next each time the end of the grid comes near', () => {
    openBig();
    expect(tiles()).toHaveLength(48);

    act(() => reachEnd?.());
    expect(tiles()).toHaveLength(96);

    act(() => reachEnd?.());
    expect(tiles()).toHaveLength(130);
    // All of it is drawn: there's no end left to come near.
    expect(reachEnd).toBeNull();
  });

  it('has every game in reach, with nothing said about a limit', () => {
    openBig();
    expect(screen.queryByText(/Showing|Search to find/)).not.toBeInTheDocument();
  });

  it('starts a new search from its first batch', () => {
    openBig();
    act(() => reachEnd?.());
    expect(tiles()).toHaveLength(96);

    search('game');
    expect(tiles()).toHaveLength(48);
    search('game 13');
    // Game 13 and Game 130.
    expect(tiles()).toHaveLength(2);
    expect(reachEnd).toBeNull();
  });

  it('watches for the end inside the grid, which is what scrolls', () => {
    const made = jest.fn();
    globalThis.IntersectionObserver = class extends ObserverInTest {
      constructor(report: (entries: { isIntersecting: boolean }[]) => void, options: unknown) {
        super(report);
        made(options);
      }
    } as unknown as typeof IntersectionObserver;
    openBig();
    expect(made).toHaveBeenCalledWith(
      expect.objectContaining({ root: screen.getByRole('list', { name: 'Your games' }) }),
    );
  });
});

it('says what to do with an empty library', () => {
  render(<FavoritesPicker games={[]} pickedIds={[]} onToggle={onToggle} onClose={onClose} />);
  expect(screen.getByText('Add games to your library to pick favorites')).toBeInTheDocument();
});

it('lets a long search that matches nothing break, so it cannot widen the dialog', () => {
  open();
  const search = screen.getByRole('textbox', { name: 'Search your games' });
  expect(search).toHaveAttribute('maxlength', '100');
  fireEvent.change(search, { target: { value: 'x'.repeat(100) } });
  expect(screen.getByText(/^No games match/, { selector: 'p:not(.sr-only)' })).toHaveClass(
    '[overflow-wrap:anywhere]',
  );
});
