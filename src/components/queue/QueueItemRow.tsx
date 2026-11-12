'use client';

import { Archive, ArrowUpToLine, Play, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CoverArt, CoverEditHint } from '@/components/games/CoverArt';
import { GameMetaRow } from '@/components/games/GameCardInfo';
import { consoleOf } from '@/lib/games/consoles';
import type { QueueItem } from '@/types/games';
import { isReleased } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';

interface QueueItemRowProps {
  item: QueueItem;
  index: number;
  /** The game being played, which Play on this row would switch from; null if none. */
  playingName: string | null;
  isLoading: boolean;
  onPick: (gameId: number) => void;
  onRemove: (gameId: number) => void;
  onOpen: (gameId: number) => void;
  /** `fromKeyboard`: pressed with Enter or Space rather than clicked. */
  onMoveToTop: (gameId: number, fromKeyboard: boolean) => void;
}

/**
 * A queue row you can drag. The drag wiring stays here, out of QueueItemRow:
 * the overlay that follows the pointer draws a QueueItemRow too, and if it
 * registered under the same id it would replace this row as a drop target and
 * take that registration with it when the drag ended, so the row couldn't be
 * dropped on again until the page reloaded.
 */
export function SortableQueueItem(props: QueueItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.game_id,
  });
  return (
    <QueueItemRow
      {...props}
      rowRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      isDragging={isDragging}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
}

export function QueueItemRow({
  item,
  index,
  playingName,
  isLoading,
  onPick,
  onRemove,
  onOpen,
  onMoveToTop,
  isOverlay,
  rowRef,
  style,
  isDragging,
  handleProps,
}: QueueItemRowProps & {
  /** The copy that follows the pointer while dragging. */
  isOverlay?: boolean;
  rowRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const zone = useReleaseZone();
  return (
    <div
      ref={rowRef}
      style={style}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-lg py-4 sm:px-3 sm:py-3 transition-[opacity,background-color] ${
        isDragging ? 'opacity-0' : 'opacity-100'
      } ${isOverlay ? 'bg-ink-800 px-3 shadow-xl shadow-black/40' : 'sm:hover:bg-ink-900'}`}
    >
      <span className="hidden sm:block w-5 text-right text-sm font-medium text-ink-500 tabular-nums shrink-0">
        {index + 1}
      </span>

      {/* The art opens the game, as on every other card. */}
      <button
        type="button"
        onClick={() => onOpen(item.game_id)}
        aria-label={`Open details for ${item.game.name}`}
        className="group w-full sm:w-48 lg:w-56 shrink-0 block rounded-lg cursor-pointer select-none focus-visible:-outline-offset-2"
      >
        <CoverArt
          src={item.game.header_image}
          alt=""
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 192px, 224px"
          className="w-full"
          interactive
          platform={consoleOf(item.game)}
          releaseDate={item.game.release_date}
        >
          <CoverEditHint />
          {/* On phones the position rides on the art. */}
          <span
            aria-hidden="true"
            className="sm:hidden absolute top-2 left-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-ink-950/90 px-1.5 text-xs font-semibold text-ink-100 tabular-nums"
          >
            {index + 1}
          </span>
        </CoverArt>
      </button>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-ink-100 sm:truncate mb-1">
            <span className="sr-only">{index + 1}. </span>
            {item.game.name}
          </p>
          <GameMetaRow
            mainStoryHours={item.game.main_story_hours}
            steamReviewScore={item.game.steam_review_score}
            steamReviewCount={item.game.steam_review_count}
            criticScore={item.game.critic_score}
            criticCount={item.game.critic_count}
            playtimeMinutes={item.game.playtime_forever}
            lastPlayedAt={item.game.last_played_at}
            deckCompat={item.game.deck_compat}
            platform={consoleOf(item.game)}
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Every game that's out can be played from here. With nothing
              playing it's the page's main action; with a game playing it
              switches to this one (the other waits at the top of the queue),
              so it's a quieter button and says what it does. */}
          {isReleased(item.game.release_date, undefined, zone) && (
            <Tooltip
              content={
                playingName ? (
                  <TooltipText
                    title={`Play instead of ${playingName}`}
                    detail={`${playingName} goes to the top of your queue.`}
                  />
                ) : (
                  <TooltipText title="Play" />
                )
              }
            >
              <Button
                size="sm"
                variant={playingName ? 'secondary' : 'primary'}
                onClick={() => onPick(item.game_id)}
                disabled={isLoading}
                aria-label={
                  playingName
                    ? `Play ${item.game.name} instead of ${playingName}`
                    : `Play ${item.game.name}`
                }
                className="cursor-pointer px-2.5 sm:px-3"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Play</span>
              </Button>
            </Tooltip>
          )}
          {/* The first game is already at the top: same-size space instead, so
              the icons line up down the list. */}
          {index > 0 ? (
            <Tooltip content={<TooltipText title="Move to top" />}>
              <button
                type="button"
                // A click from the keyboard has no pointer, so detail is 0.
                onClick={(e) => onMoveToTop(item.game_id, e.detail === 0)}
                aria-label={`Move ${item.game.name} to the top`}
                className="cursor-pointer p-1.5 text-ink-500 hover:text-ink-200 transition-colors rounded"
              >
                <ArrowUpToLine className="w-4 h-4" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : (
            <span className="w-7 h-7 shrink-0" aria-hidden="true" />
          )}
          <button
            {...handleProps}
            data-queue-handle={item.game_id}
            className="cursor-grab active:cursor-grabbing p-1.5 text-ink-500 hover:text-ink-200 transition-colors rounded"
            aria-label={`Reorder ${item.game.name}`}
          >
            <GripVertical className="w-4 h-4" aria-hidden="true" />
          </button>
          {/* Taking a game off the queue puts it back in the backlog: the same
              icon as "Move to Backlog" on the playing game, not Drop's X. */}
          <Tooltip content={<TooltipText title="Move to Backlog" />}>
            <button
              onClick={() => onRemove(item.game_id)}
              disabled={isLoading}
              aria-label={`Move ${item.game.name} to backlog`}
              className="cursor-pointer p-1.5 text-ink-500 hover:text-ink-200 disabled:opacity-50 transition-colors rounded"
            >
              <Archive className="w-4 h-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
