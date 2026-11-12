'use client';

import Link from 'next/link';
import { Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CoverThumb } from '@/components/games/CoverArt';
import { PickIcon } from '@/components/suggest/PickIcon';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { nextPlayable, upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';
import type { QueueItem } from '@/types/games';

interface UpNextProps {
  queue: QueueItem[];
  isPlaying: boolean;
  /** Every backlog game is playing or queued. */
  nothingToPick: boolean;
  /** Too few backlog games left to choose between. */
  tooFewToPick: boolean;
  onPlayNext: () => void;
  onAddGame: () => void;
  onPickNext: () => void;
}

/**
 * Up next: the game that takes over when you finish this one, and picking
 * another for the queue. The hinge between the band (now) and the shelf
 * (later). With nothing playing, the queued game is there to start, if it's out.
 */
export function UpNext({
  queue,
  isPlaying,
  nothingToPick,
  tooFewToPick,
  onPlayNext,
  onAddGame,
  onPickNext,
}: UpNextProps) {
  // The queued game that starts next: the first that's out. With only games
  // not out yet in the queue, the first of those, to say when it is.
  const zone = useReleaseZone();
  const playNext = nextPlayable(queue, undefined, zone);
  const upNext = playNext ?? queue[0];
  const upNextRelease = playNext
    ? null
    : upcomingRelease(upNext?.game.release_date, undefined, zone);

  return (
    <div
      className={`${PAGE_CONTAINER} mt-6 sm:mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4`}
    >
      {upNext ? (
        <Link
          href="/playing-queue"
          className="group flex min-w-0 items-center gap-3 sm:gap-4 rounded-lg"
        >
          <CoverThumb
            src={upNext.game.header_image}
            alt=""
            className="w-20 sm:w-28 group-hover:brightness-110 transition-[filter]"
          />
          <span className="min-w-0">
            <span className="block font-medium text-ink-100 group-hover:text-ink-50 transition-colors truncate">
              {upNext.game.name}
            </span>
            <span className="block text-sm text-ink-400">
              {upNextRelease ? `Next in your queue · ${upNextRelease.label}` : 'Next in your queue'}
            </span>
          </span>
        </Link>
      ) : (
        <p className="text-sm text-ink-400">
          Your{' '}
          <Link
            href="/playing-queue"
            className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-4 hover:text-ink-50 transition-colors"
          >
            queue
          </Link>{' '}
          is empty.{' '}
          {nothingToPick
            ? 'Add a game to have one ready for after this.'
            : tooFewToPick
              ? 'Queue a game from your library to play after this one, or add more to pick from.'
              : 'The game you pick goes there, to play after this one.'}
        </p>
      )}
      {!isPlaying ? (
        // Nothing to start until a queued game is out: picking is in the band.
        playNext && (
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={onPlayNext}
            aria-label={`Play ${playNext.game.name}`}
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>Play</span>
          </Button>
        )
      ) : tooFewToPick ? (
        // Every backlog game is playing or queued, or too few are left to
        // choose between: add more instead.
        <Button variant="secondary" className="cursor-pointer" onClick={onAddGame}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add a game</span>
        </Button>
      ) : (
        <Button variant="secondary" className="group cursor-pointer" onClick={onPickNext}>
          <PickIcon />
          <span>Pick My Next Game</span>
        </Button>
      )}
    </div>
  );
}
