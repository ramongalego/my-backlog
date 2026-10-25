'use client';

import { ListOrdered, Star } from 'lucide-react';
import type { GameItem } from '@/hooks/useGamesPage';
import type { GameStatus } from '@/lib/games/status-style';
import { CoverArt, CoverEditHint } from './CoverArt';
import { GameCardInfo } from './GameCardInfo';
import { StatusBadge } from './StatusBadge';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (appId: number) => void;
  queued?: boolean;
  /** Off when the page is already filtered to one status, so every card would say the same thing. */
  showStatus?: boolean;
}

export function GameCard({ game, onOpenDetail, queued, showStatus = true }: GameCardProps) {
  const status = (game.status ?? 'backlog') as GameStatus;

  return (
    // content-visibility lets the browser skip layout/paint for off-screen
    // cards, so a large library scrolls smoothly without DOM virtualization.
    // contain-intrinsic-size reserves an approximate height so the scrollbar
    // stays stable before a card is first rendered.
    <div className="group min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_14rem]">
      <button
        onClick={() => onOpenDetail(game.app_id)}
        className="cursor-pointer block w-full rounded-lg select-none focus-visible:-outline-offset-2"
        aria-label={`Open details for ${game.name}`}
      >
        <CoverArt
          src={game.header_image}
          alt={game.name}
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
          {(game.status === 'finished' || game.status === 'dropped') && game.rating != null && (
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
          deckCompat={game.deck_compat}
        />
      </div>
    </div>
  );
}
