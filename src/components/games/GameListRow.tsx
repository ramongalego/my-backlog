'use client';

import type { GameItem } from '@/lib/data/loaders';
import { consoleOf, platformToSay, steamLastPlayed } from '@/lib/games/consoles';
import { openGameLabel, selectGameLabel } from '@/lib/games/game-label';
import type { GameSelection } from './GameCard';
import { SelectTick } from './SelectTick';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';
import { useLibraryPlatforms } from '@/hooks/useLibraryMeta';
import { CoverThumb } from './CoverArt';
import { GameMetaRow, GameRating, Playtime, TimeToBeat } from './GameCardInfo';
import { QueuedBadge } from './QueuedBadge';
import { Rating } from './Rating';
import { StatusBadge } from './StatusBadge';
import { LIST_COLUMN, LIST_ROW, LIST_THUMB } from './game-list-columns';
import { TruncatedText } from '@/components/ui/TruncatedText';

interface GameListRowProps {
  game: GameItem;
  onOpenDetail: (gameId: number) => void;
  queued?: boolean;
  /** Off when the page is filtered to one status: the column would repeat the filter. */
  showStatus?: boolean;
  /** Off when the page is filtered to one platform: the details would repeat the filter. */
  showPlatform?: boolean;
  /** Select mode: a click ticks the game instead of opening it. */
  selection?: GameSelection;
}

/** Below `lg` the columns give way to the meta row the cards use. */
export function GameListRow({
  game,
  onOpenDetail,
  queued,
  showStatus = true,
  showPlatform = true,
  selection,
}: GameListRowProps) {
  const release = upcomingRelease(game.release_date, undefined, useReleaseZone())?.label;
  // Said in the details line: the thumbnail has no tag.
  const library = useLibraryPlatforms();
  const platform = showPlatform ? platformToSay(game, library) : null;
  const rated = (game.status === 'finished' || game.status === 'dropped') && game.rating != null;
  const badge = queued ? (
    <QueuedBadge />
  ) : (
    showStatus && game.status !== 'backlog' && <StatusBadge status={game.status} />
  );

  return (
    // The row takes the click, so its figures can still be hovered for tooltips.
    // The intrinsic size is a row's usual height, so the scrollbar holds still.
    <li
      onClick={(e) =>
        selection ? selection.selectable && selection.onToggle(e.shiftKey) : onOpenDetail(game.id)
      }
      className={`group relative ${LIST_ROW} py-2 rounded-lg select-none transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_4rem] ${
        selection && !selection.selectable
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer hover:bg-ink-900'
      } ${selection?.selected ? 'bg-ink-900' : ''}`}
    >
      <CoverThumb
        src={game.header_image}
        alt=""
        className={LIST_THUMB}
        // The row is what's pressed: its art brightens with it, unless it can't be ticked.
        interactive={!selection || selection.selectable}
      >
        {selection?.selectable && (
          <SelectTick selected={selection.selected} className="absolute top-1 left-1" />
        )}
      </CoverThumb>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* The row's control for the keyboard: its click is the row's, and
              its focus ring is drawn round the whole row. */}
          <button
            type="button"
            aria-label={
              selection
                ? selectGameLabel(game, selection, queued)
                : openGameLabel(game, { queued, showStatus, release })
            }
            aria-pressed={selection ? selection.selected : undefined}
            aria-disabled={selection && !selection.selectable ? true : undefined}
            className="min-w-0 text-left font-medium text-ink-100 cursor-pointer after:absolute after:inset-0 after:rounded-lg after:pointer-events-none focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent-400 focus-visible:after:-outline-offset-2"
          >
            <TruncatedText className="block truncate">{game.name}</TruncatedText>
          </button>
          {/* Hidden from screen readers: the status is in the button's name. */}
          {badge && (
            <span className="lg:hidden shrink-0" aria-hidden="true">
              {badge}
            </span>
          )}
        </div>
        {(platform || release) && (
          <p className="truncate text-xs text-ink-400">
            {platform}
            {/* The release is in the row's name already. */}
            {platform && release && <span aria-hidden="true"> · </span>}
            {release && <span aria-hidden="true">{release}</span>}
          </p>
        )}
        {/* The meta row sizes its contents to its own width, so it takes the rest. */}
        <div className="lg:hidden mt-1 flex items-center gap-2.5">
          {rated && (
            <span className="shrink-0" aria-hidden="true">
              <Rating rating={game.rating!} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <GameMetaRow
              mainStoryHours={game.main_story_hours}
              steamReviewScore={game.steam_review_score}
              steamReviewCount={game.steam_review_count}
              criticScore={game.critic_score}
              criticCount={game.critic_count}
              playtimeMinutes={game.playtime_forever}
              lastPlayedAt={game.last_played_at}
              deckCompat={game.deck_compat}
              console={consoleOf(game)}
            />
          </div>
        </div>
      </div>

      {/* The status and your rating are in the row's name. */}
      {showStatus && (
        <div className={LIST_COLUMN.status} aria-hidden="true">
          {badge}
        </div>
      )}
      {/* No icons: the headings say what they are. Under an hour played isn't
          shown, as on the cards. */}
      <ColumnValue className={LIST_COLUMN.toBeat}>
        {game.main_story_hours ? <TimeToBeat icon={false} hours={game.main_story_hours} /> : null}
      </ColumnValue>
      <ColumnValue className={LIST_COLUMN.rating}>
        <GameRating
          icon={false}
          criticScore={game.critic_score}
          criticCount={game.critic_count}
          steamScore={game.steam_review_score}
          steamCount={game.steam_review_count}
        />
      </ColumnValue>
      <ColumnValue className={LIST_COLUMN.played}>
        {game.playtime_forever >= 60 ? (
          <Playtime
            compact
            icon={false}
            minutes={game.playtime_forever}
            lastPlayedAt={steamLastPlayed(game)}
          />
        ) : null}
      </ColumnValue>
      <div className={LIST_COLUMN.myRating} aria-hidden="true">
        {rated && <Rating rating={game.rating!} />}
      </div>
    </li>
  );
}

/** Not tabular-nums: this face's tabular figures give the decimal point a digit's width. */
function ColumnValue({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`${className} text-sm text-ink-300`}>{children}</span>;
}
