'use client';

import { useAddToQueue, useQueue, useRemoveFromQueue } from './useQueue';
import { useSwitchGame, type SwitchedFrom } from './useSwitchGame';
import { useManualGameActions } from './useManualGameActions';
import type { QueueableGame } from '@/lib/games/queue-items';
import type { GameStatus } from '@/lib/games/status';

interface DialogOptions {
  /** The game's status (backlog unless given): only backlog games go on the queue. */
  status?: GameStatus;
  /** For the Undo after playing it instead of another. */
  from?: SwitchedFrom;
  /** For a page that does more around it (Home scrolls to the game it started). */
  onPlayInstead?: () => void | Promise<void>;
}

/**
 * Every page takes these from here, so Queue, "play this instead", a console
 * game's hours and Choose art work the same wherever a game is opened:
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
      art: { gameId: game.id },
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
