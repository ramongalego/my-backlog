'use client';

import { useAddToQueue, useQueue, useRemoveFromQueue } from './useQueue';
import { useSwitchGame, type SwitchedFrom } from './useSwitchGame';
import { useManualGameActions } from './useManualGameActions';
import type { QueueableGame } from '@/lib/games/queue-items';
import type { GameStatus } from '@/lib/games/status';

interface DialogOptions {
  /** The game's status (backlog unless given): only backlog games go on the queue. */
  status?: GameStatus;
  /**
   * Where the game is now, for the Undo after playing it instead of another:
   * its status, and a finished or dropped game's date, notes and rating.
   */
  from?: SwitchedFrom;
  /**
   * What "play this instead" does, for a page that does more around it (Home
   * scrolls to the game it started). By default the game is switched to.
   */
  onPlayInstead?: () => void | Promise<void>;
}

/**
 * The parts of a game's dialog that depend on the rest of the library: the
 * game being played, the queue, and the console a game is played on. Every
 * page that opens a library game's dialog takes them from here, so Queue,
 * "play this instead" and a console game's hours work the same wherever the
 * game is opened. Returns a function of the open game:
 *
 *   <GameDetailModal game={game} {...dialogFor(game)} ... />
 */
export function useGameDialog(userId: string | null) {
  const { queuedGameIds } = useQueue(userId);
  const addToQueue = useAddToQueue(userId);
  const removeFromQueue = useRemoveFromQueue(userId);
  const switchGame = useSwitchGame(userId);
  const manualGames = useManualGameActions(userId);

  return (game: QueueableGame, { status = 'backlog', from, onPlayInstead }: DialogOptions = {}) => {
    const playing = switchGame.playing;
    const queued = status === 'backlog' && queuedGameIds.has(game.id);
    return {
      /** A console game's hours, and removing it or moving it back to Steam. */
      manual: manualGames.dialogProps(game),
      /** Another game is being played: Playing means playing this one instead. */
      playing:
        playing && playing.id !== game.id
          ? {
              name: playing.name,
              onPlayInstead: onPlayInstead ?? (() => switchGame.switchTo(game, from ?? { status })),
            }
          : undefined,
      /** While another game is being played, a backlog game can be queued. */
      onAddToQueue: playing && status === 'backlog' && !queued ? () => addToQueue(game) : undefined,
      /** A queued game shows as Queue, and Backlog takes it off (with Undo). */
      queued: queued ? { onRemove: () => removeFromQueue(game.id) } : undefined,
    };
  };
}
