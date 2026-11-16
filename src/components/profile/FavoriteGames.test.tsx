import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ReactNode } from 'react';
import { FavoriteGames, type FavoriteGamesHandle } from '@/components/profile/FavoriteGames';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// A drag can't be acted out in jsdom (nothing has a size), so the drag context
// is stood in for: the test ends a drag by hand and checks what the row makes
// of it. Everything else is dnd-kit's own.
let endDrag: (event: { active: { id: number }; over: { id: number } | null }) => void;
let startDrag: () => void;
let instructions: string;
let announce: {
  onDragStart: (e: { active: { id: number } }) => string;
  onDragEnd: (e: { active: { id: number }; over: { id: number } | null }) => string;
  onDragCancel: (e: { active: { id: number } }) => string;
};
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  DndContext: ({
    children,
    onDragEnd,
    onDragStart,
    accessibility,
  }: {
    children: ReactNode;
    onDragEnd: typeof endDrag;
    onDragStart: typeof startDrag;
    accessibility: {
      announcements: typeof announce;
      screenReaderInstructions: { draggable: string };
    };
  }) => {
    endDrag = onDragEnd;
    startDrag = onDragStart;
    announce = accessibility.announcements;
    instructions = accessibility.screenReaderInstructions.draggable;
    return <>{children}</>;
  },
}));
jest.mock('@dnd-kit/sortable', () => ({
  ...jest.requireActual('@dnd-kit/sortable'),
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: { role: 'button', tabIndex: 0, 'aria-roledescription': 'sortable' },
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

const game = (id: number, name: string, rating: number | null = 9) => ({
  id,
  name,
  header_image: `https://example.com/${id}.jpg`,
  rating,
});
const four = [
  game(1, 'Castlevania: Aria of Sorrow', 10),
  game(2, 'Persona 5 Royal'),
  game(3, 'Metaphor: ReFantazio'),
  game(4, 'Hades', null),
];

const onChoose = jest.fn();
const onReorder = jest.fn();
const onRemove = jest.fn();
const onOpen = jest.fn();
const actions = { onChoose, onReorder, onRemove, onOpen };
beforeEach(() => jest.clearAllMocks());

const section = () => screen.getByRole('region', { name: 'Favorite games' });
const addButtons = () => screen.queryAllByRole('button', { name: 'Add a favorite game' });
const handles = () =>
  Array.from(section().querySelectorAll('[aria-roledescription="sortable"]')).map((handle) =>
    handle.getAttribute('aria-label'),
  );

describe('with none picked yet', () => {
  it('is four empty places, each opening the picker', () => {
    render(<FavoriteGames {...actions} games={[]} />);
    expect(addButtons()).toHaveLength(4);
    // The places are the way in: there's no separate button for it.
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
    // Nothing is filled in for the player: favorites are theirs to pick.
    expect(handles()).toEqual([]);

    fireEvent.click(addButtons()[2]);
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});

describe('with favorites picked', () => {
  it('shows each as art with its name and rating', () => {
    render(<FavoriteGames {...actions} games={four} />);
    expect(section().querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByText('Castlevania: Aria of Sorrow')).toBeInTheDocument();
    expect(screen.getByText('10/10')).toBeInTheDocument();
    // A game without a rating just has none drawn.
    expect(screen.getAllByText(/\/10$/)).toHaveLength(3);
    expect(addButtons()).toHaveLength(0);
  });

  it('names each favorite and its place, on the art that moves it', () => {
    render(<FavoriteGames {...actions} games={four.slice(0, 3)} />);
    expect(handles()).toEqual([
      'Castlevania: Aria of Sorrow, favorite 1 of 3',
      'Persona 5 Royal, favorite 2 of 3',
      'Metaphor: ReFantazio, favorite 3 of 3',
    ]);
    expect(screen.getByText('Drag to reorder')).toBeInTheDocument();
  });

  it('saves the new order when a favorite is dropped on another', () => {
    render(<FavoriteGames {...actions} games={four} />);
    // The first, dropped on the third.
    act(() => endDrag({ active: { id: 1 }, over: { id: 3 } }));
    expect(onReorder).toHaveBeenCalledWith([2, 3, 1, 4]);
  });

  it('shows the new order from the instant of the drop, before the page has it', () => {
    // The page's copy arrives a moment later; until then the row would show
    // the old order, and the drag library animated from it.
    const { rerender } = render(<FavoriteGames {...actions} games={four} />);
    act(() => endDrag({ active: { id: 1 }, over: { id: 3 } }));
    expect(handles()).toEqual([
      'Persona 5 Royal, favorite 1 of 4',
      'Metaphor: ReFantazio, favorite 2 of 4',
      'Castlevania: Aria of Sorrow, favorite 3 of 4',
      'Hades, favorite 4 of 4',
    ]);

    // The page catches up: nothing changes.
    const reordered = [four[1], four[2], four[0], four[3]];
    rerender(<FavoriteGames {...actions} games={reordered} />);
    expect(handles()[0]).toBe('Persona 5 Royal, favorite 1 of 4');

    // And from then on the row follows the page, e.g. a favorite taken off.
    rerender(<FavoriteGames {...actions} games={reordered.slice(1)} />);
    expect(handles()).toEqual([
      'Metaphor: ReFantazio, favorite 1 of 3',
      'Castlevania: Aria of Sorrow, favorite 2 of 3',
      'Hades, favorite 3 of 3',
    ]);
  });

  it('goes back to the saved order if the save fails', () => {
    const { rerender } = render(<FavoriteGames {...actions} games={four} />);
    act(() => endDrag({ active: { id: 1 }, over: { id: 2 } }));
    expect(handles()[0]).toBe('Persona 5 Royal, favorite 1 of 4');

    // The page shows the new order, then puts the old one back.
    rerender(<FavoriteGames {...actions} games={[four[1], four[0], four[2], four[3]]} />);
    rerender(<FavoriteGames {...actions} games={four} />);
    expect(handles()[0]).toBe('Castlevania: Aria of Sorrow, favorite 1 of 4');
  });

  it('changes nothing when a favorite is dropped where it was, or nowhere', () => {
    render(<FavoriteGames {...actions} games={four} />);
    act(() => endDrag({ active: { id: 2 }, over: { id: 2 } }));
    act(() => endDrag({ active: { id: 2 }, over: null }));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('tells a screen reader which game is moving and where, by name', () => {
    render(<FavoriteGames {...actions} games={four} />);
    expect(announce.onDragStart({ active: { id: 2 } })).toBe(
      'Picked up Persona 5 Royal, place 2 of 4.',
    );
    expect(announce.onDragEnd({ active: { id: 2 }, over: { id: 4 } })).toBe(
      'Persona 5 Royal dropped at place 4 of 4.',
    );
    expect(announce.onDragCancel({ active: { id: 2 } })).toBe(
      'Move canceled. Persona 5 Royal stays at place 2 of 4.',
    );
  });

  it('shows the X on hover or for the keyboard, not because the art was clicked', () => {
    render(<FavoriteGames {...actions} games={four} />);
    const x = screen.getByRole('button', { name: 'Remove Hades from your favorites' });
    expect(x).toHaveClass('opacity-0', 'group-hover:opacity-100');
    // Keyboard focus on the favorite or on the X itself.
    expect(x).toHaveClass('group-has-[:focus-visible]:opacity-100', 'focus-visible:opacity-100');
    // A click on the art focuses it; that alone must not hold the X there.
    expect(x).not.toHaveClass('group-focus-within:opacity-100');
    // No hover on a touchscreen: always there, with more room to hit.
    expect(x).toHaveClass('[@media(hover:none)]:opacity-100');
    expect(x).toHaveClass('[@media(hover:none)]:before:-inset-2');
  });

  it('wraps a long name where the art is narrow, and cuts it only on a desktop', () => {
    render(<FavoriteGames {...actions} games={four} />);
    const name = screen.getByText('Castlevania: Aria of Sorrow');
    expect(name).toHaveClass('lg:truncate');
    expect(name).not.toHaveClass('truncate');
  });

  describe('opening the game', () => {
    const art = (name: string) =>
      section().querySelector(`[aria-label^="${name}, favorite"]`) as HTMLElement;

    it('opens it with a click on its art, as game art does everywhere', () => {
      render(<FavoriteGames {...actions} games={four} />);
      fireEvent.click(art('Persona 5 Royal'));
      expect(onOpen).toHaveBeenCalledWith(2);
    });

    it('opens it with Enter; Space is left to pick it up', () => {
      render(<FavoriteGames {...actions} games={four} />);
      fireEvent.keyDown(art('Hades'), { key: 'Enter' });
      expect(onOpen).toHaveBeenCalledWith(4);
      fireEvent.keyDown(art('Hades'), { key: ' ' });
      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("doesn't open it from the click that ends a drag", async () => {
      jest.useFakeTimers();
      render(<FavoriteGames {...actions} games={four} />);
      act(() => startDrag());
      act(() => endDrag({ active: { id: 1 }, over: { id: 3 } }));
      // The browser's click as the button comes up, on the art it was dropped by.
      fireEvent.click(art('Castlevania: Aria of Sorrow'));
      expect(onOpen).not.toHaveBeenCalled();

      // Once that's gone by, a click opens it again.
      act(() => jest.runAllTimers());
      fireEvent.click(art('Castlevania: Aria of Sorrow'));
      expect(onOpen).toHaveBeenCalledWith(1);
      jest.useRealTimers();
    });

    it('tells a screen reader both: Enter opens it, Space moves it', () => {
      render(<FavoriteGames {...actions} games={four} />);
      expect(instructions).toMatch(/^Press Enter to open the game\. To move it, press Space/);
    });
  });

  it('takes a favorite off with the X on its art', () => {
    render(<FavoriteGames {...actions} games={four} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Persona 5 Royal from your favorites' }),
    );
    expect(onRemove).toHaveBeenCalledWith(four[1]);
  });

  describe('when a favorite is taken off from the keyboard', () => {
    const remove = (name: string) => {
      const x = screen.getByRole('button', { name: `Remove ${name} from your favorites` });
      x.focus();
      fireEvent.click(x);
    };

    it('moves focus to the empty place that opens, not back to the page', () => {
      const { rerender } = render(<FavoriteGames {...actions} games={four} />);
      remove('Persona 5 Royal');
      // The page takes the favorite off, and its X goes with it.
      rerender(<FavoriteGames {...actions} games={[four[0], four[2], four[3]]} />);
      expect(addButtons()).toHaveLength(1);
      expect(addButtons()[0]).toHaveFocus();
    });

    it('goes to the first empty place when there are several', () => {
      const { rerender } = render(<FavoriteGames {...actions} games={four.slice(0, 2)} />);
      remove('Persona 5 Royal');
      rerender(<FavoriteGames {...actions} games={four.slice(0, 1)} />);
      expect(addButtons()[0]).toHaveFocus();
    });

    it('leaves focus alone if it has gone somewhere else by then', () => {
      const { rerender } = render(
        <>
          <button>Elsewhere</button>
          <FavoriteGames {...actions} games={four} />
        </>,
      );
      remove('Persona 5 Royal');
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
      rerender(
        <>
          <button>Elsewhere</button>
          <FavoriteGames {...actions} games={[four[0], four[2], four[3]]} />
        </>,
      );
      expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    });

    it("doesn't take focus when the row gets shorter some other way", () => {
      const { rerender } = render(<FavoriteGames {...actions} games={four} />);
      // Taken off in the picker, say: nothing here was pressed.
      rerender(<FavoriteGames {...actions} games={four.slice(0, 3)} />);
      expect(document.body).toHaveFocus();
    });
  });

  it('keeps its empty places, each opening the picker', () => {
    render(<FavoriteGames {...actions} games={four.slice(0, 1)} />);
    expect(addButtons()).toHaveLength(3);

    fireEvent.click(addButtons()[0]);
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});

describe('when the page puts focus on the row', () => {
  // As it does when the picker closes and the place that opened it was filled.
  it('goes to the first empty place', () => {
    const row = createRef<FavoriteGamesHandle>();
    render(<FavoriteGames {...actions} ref={row} games={four.slice(0, 2)} />);
    act(() => row.current?.focus());
    expect(addButtons()[0]).toHaveFocus();
  });

  it('goes to the last favorite when the row is full', () => {
    const row = createRef<FavoriteGamesHandle>();
    render(<FavoriteGames {...actions} ref={row} games={four} />);
    act(() => row.current?.focus());
    expect(section().querySelector('[aria-label="Hades, favorite 4 of 4"]')).toHaveFocus();
  });
});

it('always says the row can be reordered, however many are picked', () => {
  const { rerender } = render(<FavoriteGames {...actions} games={[]} />);
  expect(screen.getByText('Drag to reorder')).toBeInTheDocument();
  rerender(<FavoriteGames {...actions} games={four.slice(0, 1)} />);
  expect(screen.getByText('Drag to reorder')).toBeInTheDocument();
  rerender(<FavoriteGames {...actions} games={four} />);
  expect(screen.getByText('Drag to reorder')).toBeInTheDocument();
});

it('has no way into the picker with all four places taken: one comes off first', () => {
  render(<FavoriteGames {...actions} games={four} />);
  expect(addButtons()).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(4);
});
