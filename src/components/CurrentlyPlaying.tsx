'use client';

import type { ReactNode } from 'react';
import { ExternalLink, Archive, Check, ListOrdered, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CoverArt } from '@/components/games/CoverArt';
import { Playtime } from '@/components/games/GameCardInfo';
import { HoursPlayedEdit } from '@/components/games/HoursPlayedEdit';
import { steamStoreUrl } from '@/lib/games/store-link';
import { consoleOf } from '@/lib/games/manual';
import { formatLastPlayed } from '@/lib/games/last-played';

interface Game {
  id: number;
  app_id: number | null;
  source?: string;
  platform?: string | null;
  name: string;
  header_image: string | null;
  main_story_hours: number | null;
  playtime_forever: number;
  last_played_at?: string | null;
  release_date?: string | null;
}

interface CurrentlyPlayingProps {
  game: Game;
  onFinish: () => void;
  onDrop: () => void;
  onCancel: () => void;
  onMoveToQueue: () => void;
  /** For a game on a console: saves the hours you enter (Steam tracks its own). */
  onSaveHours?: (hours: number) => void | Promise<void>;
  isLoading?: boolean;
  /** Just picked by Random: its art comes into focus where the backlog flicked past. */
  reveal?: boolean;
}

// The quiet actions under Finish and Drop. The padding, cancelled by the
// negative margin, makes each a 44px tap target on phones without moving it.
const TEXT_ACTION =
  'flex items-center gap-1.5 py-3 -my-3 text-sm text-ink-400 hover:text-ink-100 transition-colors disabled:opacity-50 cursor-pointer';

/**
 * Hours played against the time to beat, from the moment the game is picked
 * (0h) to when it's finished. No rating or Deck rating: they help choose a
 * game, and this one's chosen (its details dialog still has them).
 */
function Progress({
  game,
  onSaveHours,
}: {
  game: Game;
  onSaveHours?: (hours: number) => void | Promise<void>;
}) {
  const mainStoryHours = game.main_story_hours ?? 0;
  const playedHours = Math.round(game.playtime_forever / 60);
  const platform = consoleOf(game);
  // What follows the hours is hidden while they're being edited.
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
          lastPlayedAt={game.last_played_at}
          className="text-ink-200"
        />
        {after}
      </>
    );

  // Without a time to beat there's nothing to measure against: just the hours.
  if (!mainStoryHours) return <div className="text-sm">{hours()}</div>;

  if (playedHours >= mainStoryHours) {
    return (
      <div className="flex flex-wrap items-center gap-x-1 text-sm">
        {hours(<span className="text-ink-400">· past the ~{mainStoryHours}h estimate</span>)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm mb-2">
        {hours(<span className="text-ink-400 whitespace-nowrap">~{mainStoryHours}h to beat</span>)}
      </div>
      <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
        <div
          // New hours (logged, or from Steam) ease the bar to its new length.
          className="h-full bg-accent-500 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ width: `${Math.min((playedHours / mainStoryHours) * 100, 100)}%` }}
          role="progressbar"
          aria-label="Progress toward the time to beat"
          aria-valuenow={playedHours}
          aria-valuemin={0}
          aria-valuemax={mainStoryHours}
        />
      </div>
    </div>
  );
}

/** "Last played 3 days ago", from Steam; nothing when Steam doesn't share it. */
export function LastPlayed({
  lastPlayedAt,
  className = '',
}: {
  lastPlayedAt: string | null | undefined;
  className?: string;
}) {
  const text = formatLastPlayed(lastPlayedAt);
  // suppressHydrationWarning: the server and browser can straddle midnight.
  return text ? (
    <p className={`text-ink-500 ${className}`} suppressHydrationWarning>
      {text}
    </p>
  ) : null;
}

export function CurrentlyPlaying({
  game,
  onFinish,
  onDrop,
  onCancel,
  onMoveToQueue,
  onSaveHours,
  isLoading,
  reveal = false,
}: CurrentlyPlayingProps) {
  const storeUrl = steamStoreUrl(game.app_id);
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] lg:grid-cols-[minmax(0,32rem)_1fr] md:gap-10 lg:gap-12 md:items-center">
      {/* Clipped, so the art coming into focus stays inside its frame. */}
      <div className="overflow-hidden rounded-xl">
        <CoverArt
          src={game.header_image}
          alt=""
          rounded="xl"
          priority
          sizes="(max-width: 768px) 100vw, 512px"
          platform={consoleOf(game)}
          releaseDate={game.release_date}
          className={reveal ? 'animate-reveal motion-reduce:animate-overlay-in' : ''}
        />
      </div>

      <div
        className={`min-w-0 ${reveal ? 'animate-result-in [animation-delay:150ms] motion-reduce:animate-none' : ''}`}
      >
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink-50">
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group/title inline hover:underline decoration-ink-600 decoration-2 underline-offset-4"
            >
              {game.name}
              <ExternalLink
                className="inline w-4 h-4 ml-2 align-baseline text-ink-500 opacity-0 group-hover/title:opacity-100 transition-opacity"
                aria-hidden="true"
              />
            </a>
          ) : (
            game.name
          )}
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-accent-400">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-400" aria-hidden="true" />
          Playing now
          {consoleOf(game) && (
            // The console shows on the art; this is its name for screen readers.
            <span className="sr-only">on {consoleOf(game)}</span>
          )}
        </p>

        {/* As wide as the actions under it, so the progress bar ends where they do. */}
        <div className="w-fit max-w-full">
          <div className="mt-5">
            <Progress game={game} onSaveHours={onSaveHours} />
            <LastPlayed lastPlayedAt={game.last_played_at} className="mt-2 text-sm" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4">
            <div className="flex gap-2">
              <Button onClick={onFinish} disabled={isLoading} className="cursor-pointer">
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Finish</span>
              </Button>
              <Button
                onClick={onDrop}
                disabled={isLoading}
                variant="secondary"
                className="cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span>Drop</span>
              </Button>
            </div>
            <div className="flex items-center gap-5">
              <button onClick={onMoveToQueue} disabled={isLoading} className={TEXT_ACTION}>
                <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Move to Queue</span>
              </button>
              <button onClick={onCancel} disabled={isLoading} className={TEXT_ACTION}>
                <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Move to Backlog</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
