'use client';

import { Archive, ArrowUpToLine, ListOrdered, X, Play, Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { CoverArt, CoverEditHint } from '@/components/games/CoverArt';
import { HoursPlayedEdit } from '@/components/games/HoursPlayedEdit';
import { LastPlayed } from '@/components/CurrentlyPlaying';
import { GameMetaRow, Playtime } from '@/components/games/GameCardInfo';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { usePlayingQueuePage } from '@/hooks/usePlayingQueuePage';
import { todayIso } from '@/lib/diary/date-utils';
import { Page, PageHeader, SectionLabel } from '@/components/layout/Page';
import { QueueContentSkeleton } from './Skeleton';
import { consoleOf } from '@/lib/games/manual';
import { steamLastPlayed } from '@/lib/games/consoles';
import type { GameWithImage, QueueItem } from '@/types/games';

interface NowPlayingRowProps {
  game: GameWithImage;
  onFinish: () => void;
  onDrop: () => void;
  onMoveToQueue: () => void;
  onMoveToBacklog: () => void;
  /** For a game on a console: saves the hours you enter (Steam tracks its own). */
  onSaveHours?: (hours: number) => void | Promise<void>;
  isLoading?: boolean;
}

function NowPlayingRow({
  game,
  onFinish,
  onDrop,
  onMoveToQueue,
  onMoveToBacklog,
  onSaveHours,
  isLoading,
}: NowPlayingRowProps) {
  const platform = consoleOf(game);
  const mainStoryHours = game.main_story_hours ?? 0;
  const playedHours = Math.round(game.playtime_forever / 60);
  // Hours played against the time to beat from 0h on, like the card on Home;
  // no rating or Deck rating, which help choose a game and this one's chosen.
  const hours = (after?: ReactNode) =>
    onSaveHours && platform ? (
      <HoursPlayedEdit
        minutes={game.playtime_forever}
        platform={platform}
        onSave={onSaveHours}
        className="text-ink-200"
        after={after}
      />
    ) : (
      <>
        <Playtime
          minutes={game.playtime_forever}
          lastPlayedAt={steamLastPlayed(game)}
          className="text-ink-200"
        />
        {after}
      </>
    );

  const secondaryAction =
    'cursor-pointer flex items-center gap-1.5 py-3 -my-3 text-sm text-ink-400 hover:text-ink-100 disabled:opacity-50 transition-colors';

  return (
    <Panel
      padding="sm"
      className="grid gap-4 sm:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr] sm:gap-5 sm:items-center"
    >
      <CoverArt
        src={game.header_image}
        alt=""
        sizes="(max-width: 640px) 100vw, 288px"
        className="w-full"
        platform={consoleOf(game)}
        releaseDate={game.release_date}
      />

      <div className="min-w-0">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-ink-50">{game.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-medium text-accent-400">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" aria-hidden="true" />
            Playing now
          </p>
        </div>

        {/* As wide as the actions under it, so the progress bar ends where they do. */}
        <div className="w-fit max-w-full">
          <div className="mt-2">
            {!mainStoryHours ? (
              <div className="text-xs">{hours()}</div>
            ) : playedHours >= mainStoryHours ? (
              <div className="flex flex-wrap items-center gap-x-1 text-xs">
                {hours(
                  <span className="text-ink-400">· past the ~{mainStoryHours}h estimate</span>,
                )}
              </div>
            ) : (
              // The two figures at either end of the bar.
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
                  {hours(
                    <span className="text-ink-400 whitespace-nowrap">
                      ~{mainStoryHours}h to beat
                    </span>,
                  )}
                </div>
                <div className="h-1 bg-ink-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    // New hours (logged, or from Steam) ease the bar to its new length.
                    className="h-full bg-accent-500 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    style={{ width: `${(playedHours / mainStoryHours) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <LastPlayed lastPlayedAt={steamLastPlayed(game)} className="mt-1.5 text-xs" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex gap-2">
              <Button size="sm" onClick={onFinish} disabled={isLoading} className="cursor-pointer">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Finish</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={onDrop}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Drop</span>
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={onMoveToQueue} disabled={isLoading} className={secondaryAction}>
                <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Move to Queue</span>
              </button>
              <button onClick={onMoveToBacklog} disabled={isLoading} className={secondaryAction}>
                <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Move to Backlog</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

interface QueueItemRowProps {
  item: QueueItem;
  index: number;
  canPlay: boolean;
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
function SortableQueueItem(props: QueueItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
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

function QueueItemRow({
  item,
  index,
  canPlay,
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
          {canPlay && (
            <Button
              size="sm"
              onClick={() => onPick(item.game_id)}
              disabled={isLoading}
              aria-label={`Play ${item.game.name}`}
              className="cursor-pointer px-2.5 sm:px-3"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span className="hidden sm:inline">Play</span>
            </Button>
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

export default function PlayingQueueView() {
  const {
    currentlyPlaying,
    queue,
    isLoading,
    isStatusLoading,
    statusModal,
    gameSummary,
    handleFinish,
    handleDrop,
    handleMoveToQueue,
    handleMoveToBacklog,
    handleConfirm,
    handleCloseStatusModal,
    handleCloseSummary,
    handleRemoveFromQueue,
    handlePickFromQueue,
    handleReorder,
    handleMoveToTop,
    handleSetQueuedStatus,
    manualDialogProps,
  } = usePlayingQueuePage();

  const [activeId, setActiveId] = useState<number | null>(null);
  // The queued game whose details are open; read from the queue each render so
  // hours saved in the dialog show straight away.
  const [detailGameId, setDetailGameId] = useState<number | null>(null);
  const detailItem = queue.find((q) => q.game_id === detailGameId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((q) => q.id === active.id);
    const newIndex = queue.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(queue, oldIndex, newIndex);
    handleReorder(reordered.map((q) => q.game_id));
  }

  // The button goes with the game to the top, where the first game has none,
  // so focus follows the game there instead of dropping to the page: once the
  // list has re-rendered, since until then the game is still where it was.
  // From the keyboard the page scrolls along with it, so the focus stays in
  // sight; with a mouse it stays put, to move the next game up.
  const focusAfterMove = useRef<{ gameId: number; fromKeyboard: boolean } | null>(null);
  useEffect(() => {
    const pending = focusAfterMove.current;
    if (!pending) return;
    // The move is the first queue change after the click; only that one counts.
    focusAfterMove.current = null;
    if (queue[0]?.game_id !== pending.gameId) return;
    document
      .querySelector<HTMLElement>(`[data-queue-handle="${pending.gameId}"]`)
      ?.focus({ preventScroll: !pending.fromKeyboard });
  }, [queue]);

  function moveToTop(gameId: number, fromKeyboard: boolean) {
    if (handleMoveToTop(gameId)) focusAfterMove.current = { gameId, fromKeyboard };
  }

  const activeItem = activeId !== null ? queue.find((q) => q.id === activeId) : null;
  const isEmpty = !currentlyPlaying && queue.length === 0;

  return (
    <Page
      overlay={
        <>
          {statusModal && currentlyPlaying && (
            <GameDetailModal
              isOpen={true}
              onClose={handleCloseStatusModal}
              onConfirm={handleConfirm}
              gameName={currentlyPlaying.name}
              headerImage={currentlyPlaying.header_image}
              initialStatus={statusModal.action}
              initialDate={todayIso()}
              // Finishing a console game is a good moment to update its hours.
              playtimeMinutes={currentlyPlaying.playtime_forever}
              manual={manualDialogProps(currentlyPlaying)}
            />
          )}
          {detailItem && (
            <GameDetailModal
              isOpen={true}
              onClose={() => setDetailGameId(null)}
              onConfirm={(status, date, notes, rating) => {
                setDetailGameId(null);
                handleSetQueuedStatus({ gameId: detailItem.game_id, status, date, notes, rating });
              }}
              gameName={detailItem.game.name}
              headerImage={detailItem.game.header_image}
              initialStatus="backlog"
              mainStoryHours={detailItem.game.main_story_hours}
              steamReviewScore={detailItem.game.steam_review_score}
              steamReviewCount={detailItem.game.steam_review_count}
              criticScore={detailItem.game.critic_score}
              criticCount={detailItem.game.critic_count}
              playtimeMinutes={detailItem.game.playtime_forever}
              lastPlayedAt={steamLastPlayed(detailItem.game)}
              deckCompat={detailItem.game.deck_compat}
              releaseDate={detailItem.game.release_date}
              disablePlaying={!!currentlyPlaying}
              manual={manualDialogProps({ ...detailItem.game, id: detailItem.game_id })}
            />
          )}
          {gameSummary && (
            <GameSummaryModal isOpen={true} onClose={handleCloseSummary} {...gameSummary} />
          )}
        </>
      }
    >
      <PageHeader title="Playing Queue" description="What you're playing now and what's up next" />

      {isLoading ? (
        <QueueContentSkeleton />
      ) : isEmpty ? (
        <EmptyState icon={ListOrdered} title="Your queue is empty">
          Pick a game to play first, then queue up what&apos;s next from your library
        </EmptyState>
      ) : (
        <div>
          {currentlyPlaying && (
            <>
              <SectionLabel className="sr-only">Now Playing</SectionLabel>
              <NowPlayingRow
                game={currentlyPlaying}
                onFinish={handleFinish}
                onDrop={handleDrop}
                onMoveToQueue={handleMoveToQueue}
                onMoveToBacklog={handleMoveToBacklog}
                onSaveHours={manualDialogProps(currentlyPlaying)?.onSaveHours}
                isLoading={isStatusLoading}
              />
            </>
          )}

          {currentlyPlaying && queue.length > 0 && (
            <SectionLabel className="mt-10 mb-2">Up Next</SectionLabel>
          )}

          {queue.length > 0 && (
            <DndContext
              id="queue-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                {/* No scroll anchoring: with a row focused, the browser would
                    scroll after it when it moves to the top. */}
                <div className="divide-y divide-ink-800/70 [overflow-anchor:none]">
                  {queue.map((item, index) => (
                    <SortableQueueItem
                      key={item.id}
                      item={item}
                      index={index}
                      canPlay={!currentlyPlaying}
                      isLoading={isStatusLoading}
                      onPick={handlePickFromQueue}
                      onRemove={handleRemoveFromQueue}
                      onOpen={setDetailGameId}
                      onMoveToTop={moveToTop}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeItem && (
                  <QueueItemRow
                    item={activeItem}
                    index={queue.findIndex((q) => q.id === activeId)}
                    canPlay={!currentlyPlaying}
                    isLoading={isStatusLoading}
                    onPick={handlePickFromQueue}
                    onRemove={handleRemoveFromQueue}
                    onOpen={setDetailGameId}
                    onMoveToTop={moveToTop}
                    isOverlay
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}
    </Page>
  );
}
