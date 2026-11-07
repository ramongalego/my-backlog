'use client';

import { Archive, ListOrdered, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { type ReactNode } from 'react';
import { CoverArt } from '@/components/games/CoverArt';
import { HoursPlayedEdit } from '@/components/games/HoursPlayedEdit';
import { LastPlayed } from '@/components/games/LastPlayed';
import { Playtime } from '@/components/games/GameCardInfo';
import { consoleOf } from '@/lib/games/consoles';
import { steamLastPlayed } from '@/lib/games/consoles';
import type { GameWithImage } from '@/types/games';
import { playedHours } from '@/lib/games/playtime';

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

export function NowPlayingRow({
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
  const hoursPlayed = playedHours(game.playtime_forever);
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
            ) : hoursPlayed >= mainStoryHours ? (
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
                    style={{ width: `${(hoursPlayed / mainStoryHours) * 100}%` }}
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
