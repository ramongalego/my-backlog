'use client';

import { ListOrdered, Star } from 'lucide-react';
import type { GameItem } from '@/hooks/useGamesPage';
import { STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';
import { CoverArt, CoverEditHint } from './CoverArt';
import { GameCardInfo } from './GameCardInfo';
import { StatusBadge } from './StatusBadge';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (gameId: number) => void;
  queued?: boolean;
  /** Off when the page is already filtered to one status, so every card would say the same thing. */
  showStatus?: boolean;
}

export function GameCard({ game, onOpenDetail, queued, showStatus = true }: GameCardProps) {
  const status = (game.status ?? 'backlog') as GameStatus;
  const showRating = (status === 'finished' || status === 'dropped') && game.rating != null;
  // The name includes the badges shown on the art, so it matches what's on
  // screen (WCAG 2.5.3, label in name), e.g. "Open details for Celeste, Finished 9/10".
  const badgeText = queued
    ? 'Queued'
    : showStatus && status !== 'backlog'
      ? STATUS_STYLE[status].label
      : null;
  // The badges read in on-screen order as one phrase ("Finished 9/10").
  const platform = game.source === 'manual' ? game.platform : null;
  const badges = [badgeText, platform, showRating ? `${game.rating}/10` : null]
    .filter(Boolean)
    .join(' ');
  const label = `Open details for ${game.name}${badges ? `, ${badges}` : ''}`;

  return (
    // content-visibility lets the browser skip layout/paint for off-screen
    // cards, so a large library scrolls smoothly without DOM virtualization.
    // contain-intrinsic-size reserves an approximate height so the scrollbar
    // stays stable before a card is first rendered.
    <div className="group min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_14rem]">
      <button
        onClick={() => onOpenDetail(game.id)}
        className="cursor-pointer block w-full rounded-lg select-none focus-visible:-outline-offset-2"
        aria-label={label}
      >
        <CoverArt
          src={game.header_image}
          alt=""
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
          interactive
        >
          <CoverEditHint />
          <div className="absolute top-2 right-2">
            {queued ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-950/90 text-ink-200 text-xs font-medium"
                title="In playing queue"
              >
                <ListOrdered className="w-3 h-3" aria-hidden="true" />
                <span>Queued</span>
              </span>
            ) : (
              showStatus && <StatusBadge status={status} />
            )}
          </div>
          {/* Games added by hand say which console they're on. */}
          {platform && (
            <span className="absolute bottom-2 left-2 inline-flex items-center px-2 py-0.5 rounded-md bg-ink-950/90 text-ink-200 text-xs font-medium">
              {platform}
            </span>
          )}
          {showRating && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-950/90 text-xs font-medium">
              <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="text-ink-200">{game.rating}/10</span>
            </span>
          )}
        </CoverArt>
      </button>

      <div className="pt-3">
        <GameCardInfo
          appId={game.app_id}
          name={game.name}
          mainStoryHours={game.main_story_hours}
          steamReviewScore={game.steam_review_score}
          steamReviewCount={game.steam_review_count}
          playtimeMinutes={game.playtime_forever}
          lastPlayedAt={game.last_played_at}
          deckCompat={game.deck_compat}
        />
      </div>
    </div>
  );
}
