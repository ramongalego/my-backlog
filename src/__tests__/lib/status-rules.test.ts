import { applyStatusToList, statusChangeFrom, statusUpdate } from '@/lib/games/status-rules';

const now = new Date('2026-10-26T12:00:00Z');
const row = (id: number, status: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  status,
  notes: null as string | null,
  rating: null as number | null,
  finished_at: null as string | null,
  dropped_at: null as string | null,
  ...extra,
});

describe('statusUpdate', () => {
  it('starts a game with a start time', () => {
    expect(statusUpdate({ status: 'playing' }, now)).toEqual({
      status: 'playing',
      started_at: now.toISOString(),
    });
  });

  it('finishes with the date, notes and rating', () => {
    expect(
      statusUpdate({ status: 'finished', finishedAt: '2026-10-20', notes: 'Great', rating: 9 }),
    ).toEqual({ status: 'finished', finished_at: '2026-10-20', notes: 'Great', rating: 9 });
  });

  it("clears everything for Won't Play and Hidden", () => {
    expect(statusUpdate({ status: 'wont_play' })).toEqual({
      status: 'wont_play',
      started_at: null,
      finished_at: null,
      dropped_at: null,
      notes: null,
      rating: null,
    });
  });
});

describe('applyStatusToList', () => {
  it('updates the game and moves the other playing game back to the backlog', () => {
    const list = [row(1, 'playing'), row(2, 'backlog'), row(3, 'finished')];
    const next = applyStatusToList(list, { gameId: 2, status: 'playing' }, now);
    expect(next.map((g) => g.status)).toEqual(['backlog', 'playing', 'finished']);
    // Untouched rows keep their identity, so nothing else re-renders.
    expect(next[2]).toBe(list[2]);
  });

  it('only writes fields the cached row has', () => {
    const [game] = applyStatusToList([row(1, 'backlog')], { gameId: 1, status: 'playing' }, now);
    expect(game).not.toHaveProperty('started_at');
    expect(game.status).toBe('playing');
  });

  it('records a finish from the dialog fields', () => {
    const change = statusChangeFrom({
      gameId: 1,
      status: 'finished',
      date: '2026-10-25',
      notes: 'Loved it',
      rating: 10,
    });
    const [game] = applyStatusToList([row(1, 'playing')], change);
    expect(game).toMatchObject({
      status: 'finished',
      finished_at: '2026-10-25',
      notes: 'Loved it',
      rating: 10,
      dropped_at: null,
    });
  });
});
