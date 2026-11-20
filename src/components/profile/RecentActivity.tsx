'use client';

import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import Link from 'next/link';
import { ChevronDown, History } from 'lucide-react';
import { platformToSay, type LibraryPlatforms } from '@/lib/games/consoles';
import { useLibraryPlatforms } from '@/hooks/useLibraryMeta';
import { toLocalIsoDate } from '@/lib/diary/date-utils';
import { daysApart } from '@/lib/games/played-over';
import type { PublicActivity } from '@/lib/account/public-profile';
import { NEUTRAL } from './activity-line';
import { ActivityRowContent, ActivityRowLine } from './ActivityRowContent';
import { ActivityWhat } from './ActivityWhat';
import { FinishStats } from './FinishStats';
import { ProfileSection } from './ProfileSection';
import { ACTIVITY_LIST, ACTIVITY_PAGE, ACTIVITY_ROW, FINISH_ROW } from './profile-layout';

const SECTION_ID = 'profile-activity';
const LIST_ID = 'profile-activity-list';

// py-1: about 28px to hit, in a line of its own under the list.
const DISCLOSE =
  'flex cursor-pointer items-center gap-1 py-1 text-sm font-medium whitespace-nowrap text-ink-400 transition-colors hover:text-ink-100';

/**
 * What the list draws of an entry. The player's own entries (ActivityEntry)
 * have the game's id, which opens it; what other people are sent doesn't.
 */
type Entry = Omit<PublicActivity, 'games' | 'updates'> & {
  id?: number;
  games?: Entry[];
  updates?: Entry[];
};

/**
 * The library whose platforms the rows name: the player's own, or, on someone
 * else's profile, theirs as it was sent.
 */
const useRowsLibrary = (sent: LibraryPlatforms | undefined) => {
  const own = useLibraryPlatforms();
  return sent ?? own;
};

/**
 * How long a finish stands out for. Past it, it is part of the record, and a
 * list of finishes from years back doesn't all shine at once.
 */
const FINISH_STANDS_OUT_DAYS = 30;

/** By when it happened (see activityAgo): a day, or a moment, read as its day here. */
function recently(at: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(at)) return false;
  const day = at.includes('T') ? toLocalIsoDate(new Date(at)) : at;
  return daysApart(day, toLocalIsoDate(new Date())) <= FINISH_STANDS_OUT_DAYS;
}

/** A row is one button, the whole of it: it lights up under the pointer. */
const ROW_BUTTON = `${ACTIVITY_ROW} group -mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 text-left transition-colors hover:bg-ink-800/50`;

/**
 * On the player's own profile it opens the game, so a date or a rating can be
 * fixed where it's seen. On someone else's it is only to read: nothing opens.
 */
function Row({
  entry,
  library,
  onOpen,
  rowRef,
  inGroup = false,
}: {
  entry: Entry;
  library?: LibraryPlatforms;
  onOpen?: (gameId: number) => void;
  rowRef?: (row: HTMLElement | null) => void;
  /** One of a group's rows, unfolded under it. */
  inGroup?: boolean;
}) {
  const [line] = entry.lines;
  // A move says where to: the platform isn't said twice.
  const rowsLibrary = useRowsLibrary(library);
  const platform = line.kind === 'moved' ? null : platformToSay(entry, rowsLibrary);
  const gameId = entry.id;
  // A finish has what there is to say about it under it, and a recent one
  // stands out: in a group it is one line like the rest, and so is one of a
  // game that isn't finished any more.
  const finish = line.kind === 'finished' && !inGroup && !line.undone;
  const wash = finish && recently(entry.at) ? FINISH_ROW : '';
  const content = (
    <ActivityRowContent
      name={entry.name}
      art={entry.header_image}
      at={entry.at}
      interactive={!!onOpen}
      platform={platform}
    >
      <ActivityRowLine>
        <ActivityWhat line={finish ? { kind: line.kind } : line} />
      </ActivityRowLine>
      {finish && (
        <>
          {' '}
          <FinishStats line={line} />
        </>
      )}
    </ActivityRowContent>
  );
  return (
    <li>
      {onOpen && gameId != null ? (
        <button
          ref={rowRef}
          type="button"
          data-games={gameId}
          onClick={() => onOpen(gameId)}
          className={`${ROW_BUTTON} ${wash}`}
        >
          {content}
        </button>
      ) : (
        // Not a control, but Show more can still hand it the focus.
        <div ref={rowRef} tabIndex={-1} className={`${ACTIVITY_ROW} outline-none ${wash}`}>
          {content}
        </div>
      )}
    </li>
  );
}

/**
 * A bulk move (Games, Select), or several things done to one game in a row, as
 * one row that unfolds into a row for each. Its arrow sits right after its
 * name: the row's far end is for when it happened, as on every row.
 */
function GroupRow({
  entry,
  members,
  library,
  onOpen,
  buttonRef,
}: {
  entry: Entry;
  members: Entry[];
  library?: LibraryPlatforms;
  onOpen?: (gameId: number) => void;
  buttonRef?: (button: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        // The games it is about, where the list knows them: so the focus can
        // find the row a game's rows folded into.
        data-games={
          [...new Set(members.flatMap((one) => (one.id == null ? [] : [one.id])))].join(' ') ||
          undefined
        }
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={listId}
        className={ROW_BUTTON}
      >
        <ActivityRowContent
          name={entry.name}
          art={entry.header_image}
          at={entry.at}
          count={members.length}
          interactive
          afterName={
            <ChevronDown
              className={`h-4 w-4 shrink-0 self-center text-ink-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          }
        >
          <ActivityRowLine>
            {entry.updates ? (
              // Drawn as ActivityWhat draws a line, with the icon in the text.
              <span className={NEUTRAL}>
                <History
                  className="mr-1 inline-block h-3.5 w-3.5 align-[-0.125em]"
                  aria-hidden="true"
                />
                {members.length} updates
              </span>
            ) : (
              // What was done to all of them, and its own day when they share one.
              <ActivityWhat line={entry.lines[0]} />
            )}
          </ActivityRowLine>
        </ActivityRowContent>
      </button>
      <ul id={listId} hidden={!open} className="divide-y divide-ink-800/40 pl-6 sm:pl-10">
        {open &&
          members.map((one) => (
            <Row key={one.key} entry={one} library={library} onOpen={onOpen} inGroup />
          ))}
      </ul>
    </li>
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

/**
 * A list, where the favorites above are art, so the two don't read as the same
 * row twice. One component for the player's own profile and for the one other
 * people see: there it is given only the highlights, the player's `library`,
 * and no `onOpen`, so its rows open nothing (a folded row still unfolds, and
 * Show more still shows more).
 */
export function RecentActivity({
  entries,
  onOpen,
  library,
}: {
  entries: Entry[];
  /** Opens a game's dialog, by its id. Left out, the rows are only to read. */
  onOpen?: (gameId: number) => void;
  /** Whose platforms the rows name, when it isn't the visitor's own library. */
  library?: LibraryPlatforms;
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

  return (
    <ProfileSection
      id={SECTION_ID}
      title="Recent activity"
      action={
        // The Diary is the player's own: nothing leads there from someone else's profile.
        onOpen &&
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
          <ul id={LIST_ID} className={ACTIVITY_LIST} onFocus={noteFocus}>
            {entries.slice(0, shown).map((entry, index) =>
              entry.games || entry.updates ? (
                <GroupRow
                  key={entry.key}
                  entry={entry}
                  members={entry.games ?? entry.updates!}
                  library={library}
                  onOpen={onOpen}
                  buttonRef={focusIfNew(index)}
                />
              ) : (
                // By what it is about: a row (and the focus on it) stays
                // when its game's dialog changes what happened to it.
                <Row
                  key={entry.key}
                  entry={entry}
                  library={library}
                  onOpen={onOpen}
                  rowRef={focusIfNew(index)}
                />
              ),
            )}
          </ul>
          {(more > 0 || expanded) && (
            // Text buttons with a chevron: not links, which go somewhere.
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
