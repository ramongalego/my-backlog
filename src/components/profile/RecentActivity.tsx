'use client';

import { Fragment, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Clock,
  Gamepad2,
  Heart,
  HeartOff,
  ListMinus,
  ListPlus,
  Pause,
  PenLine,
  Plus,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { CoverThumb } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { consoleOf } from '@/lib/games/consoles';
import { STATUS_STYLE } from '@/lib/games/status-style';
import {
  activityDay,
  activityStamp,
  playedFor,
  type ActivityEntry,
  type ActivityKind,
  type ActivityLine,
} from '@/lib/account/activity';
import { ProfileSection } from './ProfileSection';
import {
  ACTIVITY_DATE,
  ACTIVITY_DAY,
  ACTIVITY_LIST,
  ACTIVITY_PAGE,
  ACTIVITY_ROW,
  ACTIVITY_ROWS,
  ACTIVITY_STAMP,
} from './profile-layout';
import { TruncatedText } from '@/components/ui/TruncatedText';

const SECTION_ID = 'profile-activity';

// py-1: about 28px to hit, in a line of its own under the list.
const DISCLOSE =
  'flex cursor-pointer items-center gap-1 py-1 text-sm font-medium whitespace-nowrap text-ink-400 transition-colors hover:text-ink-100';

// Everything that isn't a status stays neutral: a status keeps its color, as
// everywhere else.
const NEUTRAL = 'text-ink-300';

/** Each kind's icon and color, and what it says happened, in the past tense. */
const LINE: Record<
  ActivityKind,
  { icon: LucideIcon; text: string; what: (line: ActivityLine) => string }
> = {
  // Every line is something done, in the past tense: the game being played
  // has its start in the playing color, a start of one that isn't any more
  // is neutral.
  playing: { ...STATUS_STYLE.playing, what: () => 'Started playing' },
  started: { icon: STATUS_STYLE.playing.icon, text: NEUTRAL, what: () => 'Started playing' },
  finished: { ...STATUS_STYLE.finished, what: () => 'Finished' },
  dropped: { ...STATUS_STYLE.dropped, what: () => 'Dropped' },
  backlog: { ...STATUS_STYLE.backlog, what: () => 'Moved to backlog' },
  wont_play: { ...STATUS_STYLE.wont_play, what: () => "Marked Won't Play" },
  added: { icon: Plus, text: NEUTRAL, what: () => 'Added to backlog' },
  queued: { icon: ListPlus, text: NEUTRAL, what: () => 'Added to queue' },
  paused: { icon: Pause, text: NEUTRAL, what: () => 'Paused, moved to queue' },
  unqueued: { icon: ListMinus, text: NEUTRAL, what: () => 'Taken off the queue' },
  // The rating is the line: no second star at its end.
  rated: { icon: Star, text: NEUTRAL, what: (line) => `Rated ${line.rating}/10` },
  moved: { icon: Gamepad2, text: NEUTRAL, what: (line) => `Moved to ${line.to}` },
  favorite: { icon: Heart, text: NEUTRAL, what: () => 'Added to favorites' },
  unfavorite: { icon: HeartOff, text: NEUTRAL, what: () => 'Removed from favorites' },
  note: { icon: PenLine, text: NEUTRAL, what: () => 'Wrote a note' },
  played: {
    icon: Clock,
    text: NEUTRAL,
    what: (line) => `Played ${playedFor(line.minutes ?? 0)}`,
  },
};

/**
 * What happened to one game in one go, as a button that opens the game: to
 * fix a date or a rating where it's seen. Its name is what it shows, read in
 * order: the game and each thing that happened. Its day is said beside it,
 * once for all the rows of that day.
 */
function Row({
  entry,
  onOpen,
  buttonRef,
}: {
  entry: ActivityEntry;
  onOpen: (gameId: number) => void;
  buttonRef?: (button: HTMLElement | null) => void;
}) {
  // A move says where to: the console isn't said twice.
  const platform = entry.lines.some((line) => line.kind === 'moved') ? null : consoleOf(entry);
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpen(entry.id)}
        className={`${ACTIVITY_ROW} group -mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-ink-800/50`}
      >
        {/* The row is what's pressed: its art brightens with it, as art does everywhere. */}
        <CoverThumb src={entry.header_image} alt="" interactive />
        <span className="block min-w-0 flex-1">
          <TruncatedText className="block font-medium text-ink-100 transition-colors group-hover:text-ink-50 lg:truncate">
            {entry.name}
          </TruncatedText>{' '}
          {/* Each thing that happened on its own line, in the order it did: a
              few dots between them for the time that passed. A finish or a
              drop says its own day when that isn't the day it was logged. */}
          <span className="mt-0.5 flex flex-col text-sm text-ink-500">
            {entry.lines.map((line, index) => {
              const { icon: Icon, text, what } = LINE[line.kind];
              const latest = index === entry.lines.length - 1;
              return (
                // The lines of one row never reorder: more is only added after.
                <Fragment key={index}>
                  {index > 0 && (
                    // Under the icons, as wide as one: three dots, top to bottom.
                    <span
                      aria-hidden="true"
                      className="my-0.5 ml-[6px] block h-3 w-0 border-l-2 border-dotted border-ink-500"
                    />
                  )}
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className={`inline-flex items-center gap-1 ${text}`}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {what(line)}
                    </span>{' '}
                    {line.on && <span>{activityDay(line.on)}</span>}{' '}
                    {latest && platform && <span>on {platform}</span>}{' '}
                    {/* The rating, on the line it came with (a finish, a drop). */}
                    {line.rating != null && line.kind !== 'rated' && (
                      <Rating rating={line.rating} className="ml-auto shrink-0" />
                    )}
                  </span>{' '}
                </Fragment>
              );
            })}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * A bulk move (Games, Select) as one row: how many games and what was done to
 * them, with the first one's art and the count on it. Pressing it opens the
 * games under it, each its own row that opens its dialog, and pressing it
 * again folds them away.
 */
function BulkRow({
  entry,
  games,
  onOpen,
  buttonRef,
}: {
  entry: ActivityEntry;
  games: ActivityEntry[];
  onOpen: (gameId: number) => void;
  buttonRef?: (button: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { icon: Icon, text, what } = LINE[entry.lines[0].kind];
  const on = entry.lines[0].on;
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={listId}
        className={`${ACTIVITY_ROW} group -mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-ink-800/50`}
      >
        {/* The first game's art, with how many there are on it: the count is
            said in the row's text, so the chip is drawn, not read. */}
        <CoverThumb src={entry.header_image} alt="" interactive>
          <span
            aria-hidden="true"
            data-chip={games.length}
            className="absolute right-1.5 bottom-1.5 rounded-md bg-ink-950/90 px-1.5 py-0.5 text-xs font-medium text-ink-100 tabular-nums before:content-[attr(data-chip)]"
          />
        </CoverThumb>
        <span className="block min-w-0 flex-1">
          <span className="block font-medium text-ink-100 transition-colors group-hover:text-ink-50">
            {entry.name}
          </span>{' '}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
            <span className={`inline-flex items-center gap-1 ${text}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {what(entry.lines[0])}
            </span>{' '}
            {on && <span>{activityDay(on)}</span>}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {/* Indented under the row it opened from, a lighter rule between them. */}
      <ul id={listId} hidden={!open} className="divide-y divide-ink-800/40 pl-6 sm:pl-10">
        {open && games.map((game) => <Row key={game.key} entry={game} onOpen={onOpen} />)}
      </ul>
    </li>
  );
}

/**
 * A day, beside its rows: read as one date ("Nov 17"), drawn as a stamp with
 * the day of the month over the month, level with a row's two lines of text.
 */
function DayStamp({ day }: { day: string }) {
  const stamp = activityStamp(day);
  return (
    <h3 className={ACTIVITY_DATE}>
      <span className="sr-only">{activityDay(day)}</span>
      <span aria-hidden="true" className={ACTIVITY_STAMP}>
        <span className="text-lg leading-6 font-semibold text-ink-100">{stamp.day}</span>
        {/* The year beside the month, for another year: a line of its own would
            crowd the row beneath a one-row day. */}
        <span className="text-xs leading-5 text-ink-500">
          {stamp.month}
          {stamp.year && ` ${stamp.year}`}
        </span>
      </span>
    </h3>
  );
}

/**
 * What the player has been doing: what happened to their games, newest
 * first, a page at a time. A list, where the
 * favorites above are art, so the two don't read as the same row twice.
 */
export function RecentActivity({
  entries,
  onOpen,
}: {
  entries: ActivityEntry[];
  /** Opens a game's dialog, by its id. */
  onOpen: (gameId: number) => void;
}) {
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  // The first of the rows "Show more" adds takes the focus, so the keyboard
  // and a screen reader carry on from where the list grew (the button itself
  // goes once everything is showing).
  const firstNew = useRef<number | null>(null);
  const showMore = () => {
    firstNew.current = shown;
    setShown(shown + ACTIVITY_PAGE);
  };
  // Back to the first page: the rows the focus could be on are gone, so it
  // goes to the section itself.
  const showFewer = () => {
    setShown(ACTIVITY_PAGE);
    document.getElementById(SECTION_ID)?.focus();
  };
  const more = Math.min(ACTIVITY_PAGE, entries.length - shown);
  // More rows than the first page are on show (not only asked for: the list
  // can shrink under it, when a game is hidden or removed).
  const expanded = Math.min(shown, entries.length) > ACTIVITY_PAGE;
  const focusIfNew = (index: number) => (row: HTMLElement | null) => {
    if (row && firstNew.current === index) {
      firstNew.current = null;
      row.focus();
    }
  };

  // The rows showing, in runs of the same day.
  const days: { day: string | null; rows: { entry: ActivityEntry; index: number }[] }[] = [];
  entries.slice(0, shown).forEach((entry, index) => {
    const last = days.at(-1);
    if (last && last.day === entry.day) last.rows.push({ entry, index });
    else days.push({ day: entry.day, rows: [{ entry, index }] });
  });

  return (
    <ProfileSection
      id={SECTION_ID}
      title="Recent activity"
      action={
        entries.length > 0 && (
          <Link
            href="/diary"
            className="-my-1 py-1 text-sm text-ink-400 underline decoration-ink-600 underline-offset-4 transition-colors hover:text-ink-50"
          >
            Diary
          </Link>
        )
      }
    >
      {entries.length > 0 ? (
        <>
          <div className={ACTIVITY_LIST}>
            {days.map((day) => (
              <div key={day.rows[0].entry.key} className={ACTIVITY_DAY}>
                {/* The day is said once, for all of its rows. */}
                {day.day ? (
                  <DayStamp day={day.day} />
                ) : (
                  <span className={ACTIVITY_DATE} aria-hidden="true" />
                )}
                <ul className={ACTIVITY_ROWS}>
                  {day.rows.map(({ entry, index }) =>
                    entry.games ? (
                      <BulkRow
                        key={entry.key}
                        entry={entry}
                        games={entry.games}
                        onOpen={onOpen}
                        buttonRef={focusIfNew(index)}
                      />
                    ) : (
                      // By what it is about: a row (and the focus on it) stays
                      // when its game's dialog changes what happened to it.
                      <Row
                        key={entry.key}
                        entry={entry}
                        onOpen={onOpen}
                        buttonRef={focusIfNew(index)}
                      />
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
          {(more > 0 || expanded) && (
            // Text buttons with a chevron, as the page's other "show more"
            // controls are (Plays on, More options): not links, which go somewhere.
            <div className="mt-2 flex flex-wrap gap-x-5">
              {more > 0 && (
                <button type="button" onClick={showMore} className={DISCLOSE}>
                  Show more
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {expanded && (
                <button type="button" onClick={showFewer} className={DISCLOSE}>
                  Show fewer
                  <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-500">
          Nothing yet. What you do with your games shows up here: the ones you add, start, finish or
          drop.
        </p>
      )}
    </ProfileSection>
  );
}
