'use client';

import { Rating } from './Rating';
import type { GameItem } from '@/lib/data/loaders';
import { openGameLabel, selectGameLabel } from '@/lib/games/game-label';
import { SelectTick } from './SelectTick';
import { CoverArt } from './CoverArt';
import { GameCardInfo } from './GameCardInfo';
import { QueuedBadge } from './QueuedBadge';
import { StatusBadge } from './StatusBadge';
import { consoleOf, platformTag } from '@/lib/games/consoles';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';
import { useLibraryPlatforms } from '@/hooks/useLibraryMeta';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (gameId: number) => void;
  queued?: boolean;
  /** Off when the page is filtered to one status: every card would say the same. */
  showStatus?: boolean;
  /** Off when the page is filtered to one platform: every card would carry the same tag. */
  showPlatform?: boolean;
  /** Select mode: a click ticks the game instead of opening it. */
  selection?: GameSelection;
}

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
  showPlatform = true,
  selection,
}: GameCardProps) {
  const status = game.status;
  const showRating = (status === 'finished' || status === 'dropped') && game.rating != null;
  const release = upcomingRelease(game.release_date, undefined, useReleaseZone())?.label;
  const library = useLibraryPlatforms();
  const tag = showPlatform ? platformTag(game, library) : null;
  const art = { showStatus, console: tag, release };
  const label = openGameLabel(game, { queued, ...art });

  return (
    // content-visibility stands in for virtualizing a large library; the
    // intrinsic size keeps the scrollbar steady before a card first renders.
    <div className="min-w-0 [content-visibility:auto] [contain-intrinsic-size:auto_14rem]">
      <button
        onClick={(e) =>
          selection ? selection.selectable && selection.onToggle(e.shiftKey) : onOpenDetail(game.id)
        }
        aria-pressed={selection ? selection.selected : undefined}
        aria-disabled={selection && !selection.selectable ? true : undefined}
        className={`group relative block w-full rounded-lg select-none focus-visible:-outline-offset-2 ${
          selection && !selection.selectable ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
        }`}
        aria-label={selection ? selectGameLabel(game, selection, queued, art) : label}
      >
        <CoverArt
          src={game.header_image}
          alt=""
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 296px"
          interactive={!selection || selection.selectable}
          platform={tag}
          releaseDate={game.release_date}
        >
          {selection?.selectable && (
            <SelectTick selected={selection.selected} className="absolute top-2 left-2" />
          )}
          <div className="absolute top-2 right-2">
            {queued ? <QueuedBadge /> : showStatus && <StatusBadge status={status} />}
          </div>
          {/* A space between the badge and the rating as text (it draws nothing). */}{' '}
          {showRating && (
            <Rating rating={game.rating!} onArt className="absolute bottom-2 right-2" />
          )}
        </CoverArt>
        {/* Only the bottom of a rounded outline: a whole one is clipped by the
            card and leaves stray pixels at the top corners. */}
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
          console={consoleOf(game)}
          artTag={tag}
        />
      </div>
    </div>
  );
}
