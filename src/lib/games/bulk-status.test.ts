import {
  bulkChanges,
  isSelectable,
  reviewsCleared,
  selectRange,
  toggleSelected,
  type BulkGame,
} from '@/lib/games/bulk-status';

const game = (overrides: Partial<BulkGame> = {}): BulkGame => ({
  id: 1,
  status: 'backlog',
  finished_at: null,
  dropped_at: null,
  notes: null,
  rating: null,
  ...overrides,
});

const backlog = game({ id: 1 });
const finished = game({
  id: 2,
  status: 'finished',
  finished_at: '2026-10-25T00:00:00+00:00',
  notes: 'Loved it',
  rating: 9,
});
const hidden = game({ id: 4, status: 'hidden' });

describe('isSelectable', () => {
  it('leaves out the game being played and the ones queued', () => {
    const queued = new Set([5]);
    expect(isSelectable({ id: 1, status: 'backlog' }, queued)).toBe(true);
    expect(isSelectable({ id: 2, status: 'finished' }, queued)).toBe(true);
    expect(isSelectable({ id: 5, status: 'backlog' }, queued)).toBe(false);
    expect(isSelectable({ id: 6, status: 'playing' }, queued)).toBe(false);
  });
});

describe('bulkChanges', () => {
  it('moves each game to the status, leaving out the ones already there', () => {
    expect(bulkChanges([backlog, finished, hidden], 'hidden')).toEqual([
      { gameId: 1, status: 'hidden' },
      { gameId: 2, status: 'hidden' },
    ]);
  });

  it('keeps a rating and notes when a finished game is dropped, or the other way', () => {
    expect(bulkChanges([finished], 'dropped')).toEqual([
      { gameId: 2, status: 'dropped', notes: 'Loved it', rating: 9 },
    ]);
    // A backlog game marked finished has none to keep, and gets no date.
    expect(bulkChanges([backlog], 'finished')).toEqual([
      { gameId: 1, status: 'finished', notes: null, rating: null },
    ]);
  });
});

describe('reviewsCleared', () => {
  const noted = game({ id: 5, status: 'dropped', notes: 'Not for me' });

  it("counts the games that would lose a rating or notes to Won't Play or Hidden", () => {
    expect(reviewsCleared([backlog, finished, noted], 'hidden')).toBe(2);
    expect(reviewsCleared([backlog, finished, noted], 'wont_play')).toBe(2);
  });

  it('counts none for the statuses that keep them, or a game already there', () => {
    expect(reviewsCleared([finished, noted], 'backlog')).toBe(0);
    expect(reviewsCleared([finished, noted], 'dropped')).toBe(0);
    expect(reviewsCleared([{ ...finished, status: 'hidden' }], 'hidden')).toBe(0);
  });
});

describe('ticking games', () => {
  it('ticks and unticks one game', () => {
    const one = toggleSelected(new Set(), 3);
    expect([...one]).toEqual([3]);
    expect([...toggleSelected(one, 3)]).toEqual([]);
  });

  it('ticks everything between two games, whichever was ticked first', () => {
    const order = [10, 20, 30, 40, 50];
    expect([...selectRange(order, new Set([20]), 20, 40)]).toEqual([20, 30, 40]);
    expect([...selectRange(order, new Set([40]), 40, 20)].sort()).toEqual([20, 30, 40]);
    // What was ticked before stays ticked.
    expect([...selectRange(order, new Set([10, 50]), 50, 40)].sort()).toEqual([10, 40, 50]);
  });

  it('just ticks the game when the range has no start on the page any more', () => {
    expect([...selectRange([10, 20], new Set([99]), 99, 20)].sort()).toEqual([20, 99]);
  });
});
