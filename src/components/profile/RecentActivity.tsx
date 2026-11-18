'use client';

import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Clock,
  Heart,
  HeartOff,
  History,
  ListMinus,
  ListPlus,
  MonitorSmartphone,
  Pause,
  PenLine,
  Plus,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { CoverThumb } from '@/components/games/CoverArt';
import { Rating } from '@/components/games/Rating';
import { platformToSay } from '@/lib/games/consoles';
import { useLibraryPlatforms } from '@/hooks/useLibraryMeta';
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
const LIST_ID = 'profile-activity-list';

// py-1: about 28px to hit, in a line of its own under the list.
const DISCLOSE =
  'flex cursor-pointer items-center gap-1 py-1 text-sm font-medium whitespace-nowrap text-ink-400 transition-colors hover:text-ink-100';

// A status keeps its color, as everywhere else; everything else stays neutral.
const NEUTRAL = 'text-ink-300';

const LINE: Record<
  ActivityKind,
  { icon: LucideIcon; text: string; what: (line: ActivityLine) => string }
> = {
  // Every line is in the past tense. Only the game still being played has its
  // start in the playing color.
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
  // The platform icon, as on the Games page's platform filter (not the logo's gamepad).
  moved: { icon: MonitorSmartphone, text: NEUTRAL, what: (line) => `Moved to ${line.to}` },
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
 * Opens the game, so a date or a rating can be fixed where it's seen. Its day is
 * said beside it, once for all the rows of that day.
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
  const [line] = entry.lines;
  const { icon: Icon, text, what } = LINE[line.kind];
  // A move says where to: the platform isn't said twice.
  const library = useLibraryPlatforms();
  const platform = line.kind === 'moved' ? null : platformToSay(entry, library);
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        data-games={entry.id}
        onClick={() => onOpen(entry.id)}
        className={`${ACTIVITY_ROW} group -mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-ink-800/50`}
      >
        {/* The row is what's pressed: its art brightens with it, as art does everywhere. */}
        <CoverThumb src={entry.header_image} alt="" interactive />
        <span className="block min-w-0 flex-1">
          <TruncatedText className="block font-medium text-ink-100 transition-colors group-hover:text-ink-50 lg:truncate">
            {entry.name}
          </TruncatedText>{' '}
          {/* A finish or a drop says its own day when that isn't the day it was
              logged. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
            <span className={`inline-flex items-center gap-1 ${text}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {what(line)}
            </span>{' '}
            {line.on && <span>{activityDay(line.on)}</span>}{' '}
            {platform && <span>on {platform}</span>}{' '}
            {/* The rating it came with (a finish, a drop). */}
            {line.rating != null && line.kind !== 'rated' && (
              <Rating rating={line.rating} className="ml-auto shrink-0" />
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * A bulk move (Games, Select), or several things done to one game in a row, as
 * one row that unfolds into a row for each.
 */
function GroupRow({
  entry,
  members,
  onOpen,
  buttonRef,
}: {
  entry: ActivityEntry;
  members: ActivityEntry[];
  onOpen: (gameId: number) => void;
  buttonRef?: (button: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const {
    icon: Icon,
    text,
    what,
  } = entry.updates
    ? { icon: History, text: NEUTRAL, what: () => `${members.length} updates` }
    : LINE[entry.lines[0].kind];
  const on = entry.updates ? undefined : entry.lines[0].on;
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        data-games={[...new Set(members.map((one) => one.id))].join(' ')}
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={listId}
        className={`${ACTIVITY_ROW} group -mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-ink-800/50`}
      >
        {/* The count is said in the row's text, so the chip is drawn, not read. */}
        <CoverThumb src={entry.header_image} alt="" interactive>
          <span
            aria-hidden="true"
            data-chip={members.length}
            className="absolute right-1.5 bottom-1.5 rounded-md bg-ink-950/90 px-1.5 py-0.5 text-xs font-medium text-ink-100 tabular-nums before:content-[attr(data-chip)]"
          />
        </CoverThumb>
        <span className="block min-w-0 flex-1">
          <TruncatedText className="block font-medium text-ink-100 transition-colors group-hover:text-ink-50 lg:truncate">
            {entry.name}
          </TruncatedText>{' '}
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
      <ul id={listId} hidden={!open} className="divide-y divide-ink-800/40 pl-6 sm:pl-10">
        {open && members.map((one) => <Row key={one.key} entry={one} onOpen={onOpen} />)}
      </ul>
    </li>
  );
}

/** Read as one date ("Nov 17"), drawn as a stamp level with a row's two lines of text. */
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
 * Focuses the row a game is in now, its own or a group's (rows fold into a group
 * as more is done to a game); false when it has none.
 */
export function focusActivityRow(gameId: number): boolean {
  const row = document.querySelector<HTMLElement>(`#${LIST_ID} [data-games~="${gameId}"]`);
  row?.focus();
  return !!row;
}

/** A list, where the favorites above are art, so the two don't read as the same row twice. */
export function RecentActivity({
  entries,
  onOpen,
}: {
  entries: ActivityEntry[];
  /** Opens a game's dialog, by its id. */
  onOpen: (gameId: number) => void;
}) {
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  // The row last focused, and its game. When the list changes under it (its
  // game's dialog changed something, and its rows folded into a group), the
  // focus goes on to the row that game is in now, not back to the page.
  const focused = useRef<{ row: HTMLElement; game: number } | null>(null);
  const noteFocus = (event: FocusEvent) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-games]');
    focused.current = row ? { row, game: Number(row.dataset.games!.split(' ')[0]) } : null;
  };
  useEffect(() => {
    const was = focused.current;
    if (!was || was.row.isConnected || document.activeElement !== document.body) return;
    focusActivityRow(was.game);
  }, [entries]);
  // The first row "Show more" adds takes the focus, so the keyboard and a screen
  // reader carry on where the list grew (the button goes once everything shows).
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
  // Keyed by the day, not its first row: a new row at the top of a day would
  // otherwise redraw the whole day, and lose the focus on a row in it.
  const days: {
    key: string;
    day: string | null;
    rows: { entry: ActivityEntry; index: number }[];
  }[] = [];
  entries.slice(0, shown).forEach((entry, index) => {
    const last = days.at(-1);
    if (last && last.day === entry.day) {
      last.rows.push({ entry, index });
      return;
    }
    const again = days.filter((one) => one.day === entry.day).length;
    days.push({
      key: `${entry.day ?? 'unknown'}-${again}`,
      day: entry.day,
      rows: [{ entry, index }],
    });
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
          <div id={LIST_ID} className={ACTIVITY_LIST} onFocus={noteFocus}>
            {days.map((day) => (
              <div key={day.key} className={ACTIVITY_DAY}>
                {/* The day is said once, for all of its rows. */}
                {day.day ? (
                  <DayStamp day={day.day} />
                ) : (
                  <span className={ACTIVITY_DATE} aria-hidden="true" />
                )}
                <ul className={ACTIVITY_ROWS}>
                  {day.rows.map(({ entry, index }) =>
                    entry.games || entry.updates ? (
                      <GroupRow
                        key={entry.key}
                        entry={entry}
                        members={entry.games ?? entry.updates!}
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
