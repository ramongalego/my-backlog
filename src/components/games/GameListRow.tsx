'use client';

import type { GameItem } from '@/lib/data/loaders';
import { consoleOf, steamLastPlayed } from '@/lib/games/consoles';
import { openGameLabel } from '@/lib/games/game-label';
import { upcomingRelease } from '@/lib/games/release-date';
import { useReleaseZone } from '@/hooks/useReleaseZone';
import { CoverThumb } from './CoverArt';
import { GameMetaRow, GameRating, Playtime, TimeToBeat } from './GameCardInfo';
import { QueuedBadge } from './QueuedBadge';
import { Rating } from './Rating';
import { StatusBadge } from './StatusBadge';
import { LIST_COLUMN, LIST_ROW, LIST_THUMB } from './game-list-columns';

interface GameListRowProps {
  game: GameItem;
  onOpenDetail: (gameId: number) => void;
  queued?: boolean;
  /** Off when the page is filtered to one status: the column would repeat the filter. */
  showStatus?: boolean;
}

/**
 * A game in the Games page's list view: small art and the name, then its
 * details in columns that line up down the list (status, time to beat, rating,
 * hours played, your rating). Below `lg` the columns give way to the meta row
 * the cards use. The whole row opens the game.
 */
export function GameListRow({ game, onOpenDetail, queued, showStatus = true }: GameListRowProps) {
  const release = upcomingRelease(game.release_date, undefined, useReleaseZone())?.label;
  const platform = consoleOf(game);
  const rated = (game.status === 'finished' || game.status === 'dropped') && game.rating != null;
  const badge = queued ? (
    <QueuedBadge />
  ) : (
    showStatus && game.status !== 'backlog' && <StatusBadge status={game.status} />
  );

  return (
    // The row takes the click, so its figures can still be hovered for their
    // tooltips, as on the cards (a click on one still opens the game; a tap on
    // a touchscreen reads the tooltip instead). content-visibility skips laying
    // out rows off screen; the intrinsic size is a row's usual height, so the
    // scrollbar holds still.
    <li
      onClick={() => onOpenDetail(game.id)}
      className={`group relative ${LIST_ROW} py-2 rounded-lg cursor-pointer select-none hover:bg-ink-900 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_4rem]`}
    >
      <CoverThumb src={game.header_image} alt="" className={LIST_THUMB} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* The row's control for the keyboard: its click is the row's, and
              its focus ring is drawn round the whole row. */}
          <button
            type="button"
            aria-label={openGameLabel(game, { queued, showStatus, release })}
            className="min-w-0 truncate text-left font-medium text-ink-100 cursor-pointer after:absolute after:inset-0 after:rounded-lg after:pointer-events-none focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent-400 focus-visible:after:-outline-offset-2"
          >
            {game.name}
          </button>
          {/* Below lg the status rides beside the name; from lg it has a column. */}
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
        {/* Below lg: your rating, then the same meta row as the cards. The meta
            row sizes its contents to its own width, so it takes the rest. */}
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
              platform={platform}
            />
          </div>
        </div>
      </div>

      {/* From lg: columns. The status and your rating are in the row's name. */}
      {showStatus && (
        <div className={LIST_COLUMN.status} aria-hidden="true">
          {badge}
        </div>
      )}
      {/* The cards' figures without their icons (the headings say what they
          are), with the same tooltips. Under an hour played isn't shown, as
          on the cards. */}
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

/**
 * A column's figure. Proportional figures: this face's tabular ones give the
 * decimal point a digit's width ("23 . 4h").
 */
function ColumnValue({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`${className} text-sm text-ink-300`}>{children}</span>;
}
