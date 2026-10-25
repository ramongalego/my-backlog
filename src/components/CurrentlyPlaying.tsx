'use client';

import type { ReactNode } from 'react';
import { ExternalLink, Archive, Check, ListOrdered, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CoverArt } from '@/components/games/CoverArt';
import { SteamScore, TimeToBeat } from '@/components/games/GameCardInfo';
import { SteamDeckBadge } from '@/components/games/SteamDeckBadge';
import { formatLastPlayed } from '@/lib/games/last-played';

interface Game {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number | null;
  playtime_forever: number;
  steam_review_score?: number | null;
  steam_review_count?: number | null;
  deck_compat?: number | null;
  last_played_at?: string | null;
}

interface CurrentlyPlayingProps {
  game: Game;
  onFinish: () => void;
  onDrop: () => void;
  onCancel: () => void;
  onMoveToQueue: () => void;
  isLoading?: boolean;
  /** Rendered under the game's actions (the "pick my next game" prompt). */
  footer?: ReactNode;
}

function Progress({ game }: { game: Game }) {
  const mainStoryHours = game.main_story_hours ?? 0;
  const playedHours = Math.round(game.playtime_forever / 60);

  if (!mainStoryHours) return null;

  if (game.playtime_forever < 60) {
    return (
      <div className="flex items-center gap-3 text-sm text-ink-400">
        <TimeToBeat hours={mainStoryHours} iconClassName="w-3.5 h-3.5" />
        {game.steam_review_score != null && (
          <SteamScore
            score={game.steam_review_score}
            count={game.steam_review_count}
            iconClassName="w-3.5 h-3.5"
          />
        )}
        <SteamDeckBadge deckCompat={game.deck_compat} />
      </div>
    );
  }

  if (playedHours >= mainStoryHours) {
    return (
      <p className="text-sm">
        <span className="text-ink-200">{playedHours}h played</span>
        <span className="text-ink-400"> · past the ~{mainStoryHours}h estimate</span>
      </p>
    );
  }

  return (
    <div className="max-w-sm">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-ink-200">{playedHours}h played</span>
        <span className="text-ink-400">~{mainStoryHours}h to beat</span>
      </div>
      <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-500 rounded-full"
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
  isLoading,
  footer,
}: CurrentlyPlayingProps) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] md:gap-10 md:items-center">
      <CoverArt
        src={game.header_image}
        alt=""
        rounded="xl"
        priority
        sizes="(max-width: 768px) 100vw, 480px"
      />

      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink-50">
          <a
            href={`https://store.steampowered.com/app/${game.app_id}/`}
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
        </h1>
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-accent-400">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-400" aria-hidden="true" />
          Playing now
        </p>

        <div className="mt-5">
          <Progress game={game} />
          <LastPlayed lastPlayedAt={game.last_played_at} className="mt-2 text-sm" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
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
            <button
              onClick={onMoveToQueue}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Move to Queue</span>
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Move to Backlog</span>
            </button>
          </div>
        </div>

        {footer && <div className="mt-6 pt-6 border-t border-ink-800">{footer}</div>}
      </div>
    </div>
  );
}
