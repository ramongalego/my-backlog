import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GamesBulkBar } from '@/components/games/GamesBulkBar';
import type { BulkStatus } from '@/lib/games/status';

const onSelectAll = jest.fn();
const onClear = jest.fn();
const onMove = jest.fn();
const onClose = jest.fn();

function bar(
  props: {
    count?: number;
    total?: number;
    pending?: boolean;
    moves?: (status: BulkStatus) => number;
    reviewsCleared?: (status: BulkStatus) => number;
  } = {},
) {
  return render(
    <GamesBulkBar
      count={props.count ?? 3}
      total={props.total ?? 85}
      onSelectAll={onSelectAll}
      onClear={onClear}
      // Unless a test says otherwise, every ticked game would move.
      moves={props.moves ?? (() => props.count ?? 3)}
      reviewsCleared={props.reviewsCleared ?? (() => 0)}
      onMove={onMove}
      pending={props.pending ?? false}
      onClose={onClose}
    />,
  );
}

const status = (name: string) => screen.getByRole('button', { name });
const moveButton = () => screen.getByRole('button', { name: 'Move' });

beforeEach(() => jest.clearAllMocks());

it('says how many games are ticked, and offers every status but Playing to pick from', () => {
  bar();

  expect(screen.getByRole('region', { name: 'Selected games' })).toHaveTextContent('3 selected');
  const statuses = within(screen.getByRole('group', { name: 'Move to' }));
  expect(statuses.getAllByRole('button').map((b) => b.textContent)).toEqual([
    'Backlog',
    'Finished',
    'Dropped',
    "Won't Play",
    'Hidden',
  ]);
  // Nothing is picked to start with.
  expect(
    statuses.getAllByRole('button').every((b) => b.getAttribute('aria-pressed') === 'false'),
  ).toBe(true);
});

describe('moving', () => {
  it('picks where they go without moving anything, then moves on Move', () => {
    bar();
    expect(moveButton()).toBeDisabled();

    fireEvent.click(status('Hidden'));
    expect(onMove).not.toHaveBeenCalled();
    expect(status('Hidden')).toHaveAttribute('aria-pressed', 'true');
    expect(moveButton()).toBeEnabled();

    fireEvent.click(moveButton());
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('hidden');
  });

  it('picks one status at a time, and unpicks it on a second click', () => {
    bar();
    fireEvent.click(status('Hidden'));
    fireEvent.click(status('Finished'));
    expect(status('Hidden')).toHaveAttribute('aria-pressed', 'false');
    expect(status('Finished')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(status('Finished'));
    expect(status('Finished')).toHaveAttribute('aria-pressed', 'false');
    expect(moveButton()).toBeDisabled();
  });

  it('keeps the pick after Move is pressed: the page closes the bar once the move is saved', () => {
    bar();
    fireEvent.click(status('Hidden'));
    fireEvent.click(moveButton());

    expect(status('Hidden')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has nothing to move until a game is ticked, though a status can be picked first', () => {
    bar({ count: 0 });
    fireEvent.click(status('Hidden'));

    expect(status('Hidden')).toHaveAttribute('aria-pressed', 'true');
    expect(moveButton()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('says "Moving…" while a move is saved, and holds everything else still', () => {
    bar({ pending: true });

    expect(screen.getByRole('button', { name: 'Moving…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
    expect(status('Hidden')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select all 85' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    // Closing is still allowed: the move carries on.
    expect(screen.getByRole('button', { name: 'Close selection' })).toBeEnabled();
  });
});

describe('a status every ticked game already has', () => {
  // Two Won't Play games ticked: moving them there would do nothing.
  const allWontPlay = (s: BulkStatus) => (s === 'wont_play' ? 0 : 2);
  // Then a backlog game as well: now one of the three would move.
  const oneMore = (s: BulkStatus) => (s === 'wont_play' ? 1 : s === 'backlog' ? 2 : 3);

  it("is dimmed and can't be picked, while the others can", () => {
    bar({ count: 2, moves: allWontPlay });

    expect(status("Won't Play")).toBeDisabled();
    expect(status('Hidden')).toBeEnabled();

    fireEvent.click(status("Won't Play"));
    expect(status("Won't Play")).toHaveAttribute('aria-pressed', 'false');
    expect(moveButton()).toBeDisabled();
  });

  it('can be picked again once a game it would move is ticked', () => {
    const { rerender } = bar({ count: 2, moves: allWontPlay });
    expect(status("Won't Play")).toBeDisabled();

    rerender(
      <GamesBulkBar
        count={3}
        total={85}
        onSelectAll={onSelectAll}
        onClear={onClear}
        moves={oneMore}
        reviewsCleared={() => 0}
        onMove={onMove}
        pending={false}
        onClose={onClose}
      />,
    );

    expect(status("Won't Play")).toBeEnabled();
    fireEvent.click(status("Won't Play"));
    fireEvent.click(moveButton());
    expect(onMove).toHaveBeenCalledWith('wont_play');
  });

  it('stops counting as picked when the ticked games turn out to be there already', () => {
    // Picked first, with nothing ticked: any status can be.
    const { rerender } = bar({ count: 0, moves: () => 0 });
    expect(status("Won't Play")).toBeEnabled();
    fireEvent.click(status("Won't Play"));
    expect(status("Won't Play")).toHaveAttribute('aria-pressed', 'true');

    const withGames = (count: number, moves: (s: BulkStatus) => number) =>
      rerender(
        <GamesBulkBar
          count={count}
          total={85}
          onSelectAll={onSelectAll}
          onClear={onClear}
          moves={moves}
          reviewsCleared={() => 0}
          onMove={onMove}
          pending={false}
          onClose={onClose}
        />,
      );

    withGames(2, allWontPlay);
    expect(status("Won't Play")).toHaveAttribute('aria-pressed', 'false');
    expect(moveButton()).toBeDisabled();

    // A game it would move is ticked: the pick stands again.
    withGames(3, oneMore);
    expect(status("Won't Play")).toHaveAttribute('aria-pressed', 'true');
    expect(moveButton()).toBeEnabled();
  });
});

it('ticks everything the page lists, until everything is', () => {
  const { unmount } = bar();
  fireEvent.click(screen.getByRole('button', { name: 'Select all 85' }));
  expect(onSelectAll).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(onClear).toHaveBeenCalled();
  unmount();

  bar({ count: 85 });
  expect(screen.queryByRole('button', { name: /Select all/ })).not.toBeInTheDocument();
});

describe('games that would lose a rating or notes', () => {
  const twoOfThree = (s: BulkStatus) => (s === 'hidden' || s === 'wont_play' ? 2 : 0);

  it('says how many as soon as the status is picked, before anything moves', () => {
    bar({ reviewsCleared: twoOfThree });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(status('Hidden'));

    expect(screen.getByRole('status')).toHaveTextContent(
      '2 of these have a rating or notes. Moving to Hidden clears them.',
    );
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(moveButton());
    expect(onMove).toHaveBeenCalledWith('hidden');
  });

  it('words it for one game, and for all of them', () => {
    const { unmount } = bar({ count: 1, reviewsCleared: () => 1 });
    fireEvent.click(status("Won't Play"));
    expect(screen.getByRole('status')).toHaveTextContent(
      "It has a rating or notes. Moving to Won't Play clears them.",
    );
    unmount();

    bar({ reviewsCleared: () => 3 });
    fireEvent.click(status('Hidden'));
    expect(screen.getByRole('status')).toHaveTextContent('All 3 have a rating or notes.');
    cleanup();

    bar({ count: 2, reviewsCleared: () => 2 });
    fireEvent.click(status('Hidden'));
    expect(screen.getByRole('status')).toHaveTextContent('Both have a rating or notes.');
  });

  it('says nothing for a status that keeps them, or once another is picked', () => {
    bar({ reviewsCleared: twoOfThree });
    fireEvent.click(status('Hidden'));
    fireEvent.click(status('Finished'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('closing', () => {
  it('ends Select mode from the bar, or with Escape', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Close selection' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no Done: closing is the X', () => {
    bar();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('leaves Escape to a dialog that closes itself on the same key press', () => {
    bar();
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    // The dialog handles the key first and is gone by the time it gets to the bar.
    const closeDialog = () => dialog.remove();
    document.body.addEventListener('keydown', closeDialog);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(dialog.isConnected).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    document.body.removeEventListener('keydown', closeDialog);

    // With nothing over the page any more, the next Escape is the bar's.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to an open menu too', () => {
    bar();
    const menu = document.body.appendChild(document.createElement('ul'));
    menu.setAttribute('role', 'listbox');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    menu.remove();
  });

  it('leaves Escape to a dialog that is open over the page', () => {
    bar();
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    dialog.remove();
  });
});

it('tells the page how tall it is while it is there, so toasts sit above it', () => {
  const { unmount } = bar();
  expect(document.documentElement.style.getPropertyValue('--bulk-bar')).toMatch(/px$/);
  unmount();
  expect(document.documentElement.style.getPropertyValue('--bulk-bar')).toBe('');
});
