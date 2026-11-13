'use client';

import { Rating } from './Rating';
import type { GameItem } from '@/lib/data/loaders';
import { openGameLabel, selectGameLabel } from '@/lib/games/game-label';
import { SelectTick } from './SelectTick';
import { CoverArt, CoverEditHint } from './CoverArt';
import { GameCardInfo } from './GameCardInfo';
import { QueuedBadge } from './QueuedBadge';
import { StatusBadge } from './StatusBadge';
import { consoleOf } from '@/lib/games/consoles';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (gameId: number) => void;
  queued?: boolean;
  /** Off when the page is already filtered to one status, so every card would say the same thing. */
  showStatus?: boolean;
  /** Select mode: a click ticks the game instead of opening it. */
  selection?: GameSelection;
}

/** A game's part in Select mode: whether it's ticked, and whether it can be. */
export interface GameSelection {
  selected: boolean;
  /** Not the game being played or a queued one. */
  selectable: boolean;
  /** `range` (shift-click) ticks every game from the last one ticked to this one. */
  onToggle: (range: boolean) => void;
}

export function GameCard({
  game,
  onOpenDetail,
  queued,
  showStatus = true,
  selection,
}: GameCardProps) {
  const status = game.status;
  const showRating = (status === 'finished' || status === 'dropped') && game.rating != null;
  const release = upcomingRelease(game.release_date, undefined, useReleaseZone())?.label;
  const label = openGameLabel(game, { queued, showStatus, release });

  return (
    // content-visibility lets the browser skip layout/paint for off-screen
    // cards, so a large library scrolls smoothly without DOM virtualization.
    // contain-intrinsic-size reserves an approximate height so the scrollbar
    // stays stable before a card is first rendered.
    <div className="group min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_14rem]">
      <button
        onClick={(e) =>
          selection ? selection.selectable && selection.onToggle(e.shiftKey) : onOpenDetail(game.id)
        }
        aria-pressed={selection ? selection.selected : undefined}
        aria-disabled={selection && !selection.selectable ? true : undefined}
        className={`relative block w-full rounded-lg select-none focus-visible:-outline-offset-2 ${
          selection && !selection.selectable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
        }`}
        aria-label={selection ? selectGameLabel(game, selection, queued) : label}
      >
        <CoverArt
          src={game.header_image}
          alt=""
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 296px"
          interactive
          platform={consoleOf(game)}
          releaseDate={game.release_date}
        >
          {selection ? (
            selection.selectable && (
              <SelectTick selected={selection.selected} className="absolute top-2 left-2" />
            )
          ) : (
            <CoverEditHint />
          )}
          <div className="absolute top-2 right-2">
            {queued ? <QueuedBadge /> : showStatus && <StatusBadge status={status} />}
          </div>
          {showRating && (
            <Rating rating={game.rating!} onArt className="absolute bottom-2 right-2" />
          )}
        </CoverArt>
        {/* A ticked game is underlined just below its art, the line curving
            up round the art's bottom corners: the bottom of a rounded outline,
            cut off at the art's sides. (A whole outline is clipped by the card,
            which left stray pixels at the top corners.) */}
        {selection?.selected && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -bottom-1 h-3 overflow-hidden"
          >
            <span className="absolute -inset-x-1 bottom-0 h-10 rounded-xl border-2 border-ink-50" />
          </span>
        )}
      </button>

      <div className="pt-3">
        <GameCardInfo
          appId={game.app_id}
          name={game.name}
          mainStoryHours={game.main_story_hours}
          steamReviewScore={game.steam_review_score}
          steamReviewCount={game.steam_review_count}
          criticScore={game.critic_score}
          criticCount={game.critic_count}
          playtimeMinutes={game.playtime_forever}
          lastPlayedAt={game.last_played_at}
          deckCompat={game.deck_compat}
          platform={consoleOf(game)}
        />
      </div>
    </div>
  );
}
