import type { ReactNode } from 'react';
import { CoverThumb } from '@/components/games/CoverArt';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { activityAgo } from '@/lib/account/activity';
import { ACTIVITY_THUMB } from './profile-layout';

/**
 * What every activity row is made of, in the player's own list and in the feed
 * others see: the art, the name, when it happened at the far end, alone, and
 * the lines under the name. The list decides what the row is (a button that
 * opens the game, or only something to read) and wraps this in it. Spans
 * throughout, so it can sit inside a button.
 */
export function ActivityRowContent({
  name,
  art,
  at,
  count,
  interactive = false,
  afterName,
  now,
  children,
}: {
  name: string;
  art: string | null;
  /** A moment, a day, or '' when nothing says when (see activityAgo). */
  at: string;
  /** For a row about several things: how many, as a chip on the art. */
  count?: number;
  /** The row is pressed: its art brightens with it, as art does everywhere. */
  interactive?: boolean;
  /** Right after the name: the arrow of a row that unfolds. */
  afterName?: ReactNode;
  now?: Date;
  /** The lines under the name (ActivityRowLine). */
  children: ReactNode;
}) {
  const ago = activityAgo(at, now);
  return (
    <>
      <CoverThumb src={art} alt="" interactive={interactive} className={ACTIVITY_THUMB}>
        {count != null && (
          // The count is said in the row's text, so the chip is drawn, not read.
          <span
            aria-hidden="true"
            data-chip={count}
            className="absolute right-1.5 bottom-1.5 rounded-md bg-ink-950/90 px-1.5 py-0.5 text-xs font-medium text-ink-100 tabular-nums before:content-[attr(data-chip)]"
          />
        )}
      </CoverThumb>
      <span className="block min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1">
            <TruncatedText className="block min-w-0 font-medium text-ink-100 transition-colors group-hover:text-ink-50 lg:truncate">
              {name}
            </TruncatedText>
            {afterName}
          </span>{' '}
          {ago && (
            <time
              dateTime={at}
              // Said on the server and again in the browser a moment later: a
              // minute ticking over between the two isn't a mismatch to report.
              suppressHydrationWarning
              // Not `tabular-nums`: fixed-width digits push the comma of
              // "Aug 20, 2025" away from its number.
              className="shrink-0 text-xs font-normal whitespace-nowrap text-ink-500"
            >
              {ago}
            </time>
          )}
        </span>{' '}
        {children}
      </span>
    </>
  );
}

/** One line under a row's name. */
export function ActivityRowLine({ children }: { children: ReactNode }) {
  return (
    <span data-line className="mt-0.5 block text-sm text-ink-500">
      {children}
    </span>
  );
}
