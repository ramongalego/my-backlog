import { renderHook } from '@testing-library/react';
import { useGameDialog } from '@/hooks/useGameDialog';

let playing: { id: number; name: string } | null = null;
let queuedIds: number[] = [];
const addToQueue = jest.fn();
const removeFromQueue = jest.fn();
const switchTo = jest.fn();

jest.mock('@/hooks/useQueue', () => ({
  useQueue: () => ({ queuedGameIds: new Set(queuedIds) }),
  useAddToQueue: () => addToQueue,
  useRemoveFromQueue: () => removeFromQueue,
}));
jest.mock('@/hooks/useSwitchGame', () => ({
  useSwitchGame: () => ({ playing, switchTo }),
}));
jest.mock('@/hooks/useManualGameActions', () => ({
  // The real one answers only for games played on a console.
  useManualGameActions: () => ({
    dialogProps: (game: { platform?: string | null }) =>
      game.platform && game.platform !== 'PC' ? { platform: game.platform } : undefined,
  }),
}));

const hades = {
  id: 1,
  app_id: 1145360,
  name: 'Hades',
  header_image: null,
  main_story_hours: 23,
  playtime_forever: 0,
};
const zelda = { id: 9, name: 'Zelda' };

const dialogFor = () => renderHook(() => useGameDialog('user-1')).result.current;

beforeEach(() => {
  playing = null;
  queuedIds = [];
  jest.clearAllMocks();
});

describe('with nothing being played', () => {
  it('offers neither a switch nor the queue: Playing just starts the game', () => {
    expect(dialogFor()(hades)).toEqual({
      // Any library game's art can be chosen.
      art: { gameId: 1 },
      manual: undefined,
      playing: undefined,
      onAddToQueue: undefined,
      queued: undefined,
    });
  });

  it('still shows a queued game as queued, with Backlog taking it off', () => {
    queuedIds = [1];

    const props = dialogFor()(hades);
    props.queued?.onRemove();

    expect(removeFromQueue).toHaveBeenCalledWith(1);
    expect(props.onAddToQueue).toBeUndefined();
  });
});

describe('while another game is being played', () => {
  beforeEach(() => {
    playing = zelda;
  });

  it('names it, and plays this game instead from the backlog', () => {
    const props = dialogFor()(hades);

    expect(props.playing?.name).toBe('Zelda');
    void props.playing?.onPlayInstead();
    expect(switchTo).toHaveBeenCalledWith(hades, { status: 'backlog' });
  });

  it('lets a backlog game be queued', () => {
    dialogFor()(hades).onAddToQueue?.();
    expect(addToQueue).toHaveBeenCalledWith(hades);
  });

  it("doesn't offer to queue a game that's already queued", () => {
    queuedIds = [1];
    const props = dialogFor()(hades);
    expect(props.onAddToQueue).toBeUndefined();
    expect(props.queued).toBeDefined();
  });

  it.each(['finished', 'dropped', 'wont_play', 'hidden'] as const)(
    'keeps a %s game off the queue, even if a stale queue still lists it',
    (status) => {
      queuedIds = [1];
      const props = dialogFor()(hades, { status });
      expect(props.onAddToQueue).toBeUndefined();
      expect(props.queued).toBeUndefined();
    },
  );

  it('tells the switch where a finished game was, for Undo', () => {
    const from = { status: 'finished' as const, date: '2026-10-20', notes: 'Great', rating: 9 };

    void dialogFor()(hades, { status: 'finished', from }).playing?.onPlayInstead();

    expect(switchTo).toHaveBeenCalledWith(hades, from);
  });

  it("uses the page's own switch when it has one", () => {
    const onPlayInstead = jest.fn();

    void dialogFor()(hades, { onPlayInstead }).playing?.onPlayInstead();

    expect(onPlayInstead).toHaveBeenCalled();
    expect(switchTo).not.toHaveBeenCalled();
  });

  it("offers no switch in the playing game's own dialog", () => {
    playing = { id: 1, name: 'Hades' };
    const props = dialogFor()(hades, { status: 'playing' });
    expect(props.playing).toBeUndefined();
    expect(props.onAddToQueue).toBeUndefined();
  });
});

it("carries a console game's own details", () => {
  expect(dialogFor()({ ...hades, source: 'manual', platform: 'Switch' }).manual).toEqual({
    platform: 'Switch',
  });
});
