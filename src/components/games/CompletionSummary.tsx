import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Figure, Lead } from '@/components/ui/Lead';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { CoverThumb } from './CoverArt';
import { Rating } from './Rating';

interface Completion {
  playtimeMinutes: number;
  mainStoryHours: number | null;
  rating: number | null;
  gamesFinished: number;
  totalGames: number;
  nextGame: string | null;
}

const hours = (h: number) => `${h} hour${h === 1 ? '' : 's'}`;

/** A figure and its unit stay on one line ("25.5 hours", never "25.5 / hours"). */
const whole = (figure: string) => <span className="whitespace-nowrap">{figure}</span>;

const DAY_MS = 24 * 60 * 60 * 1000;

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/**
 * From starting it in the app to finishing it, roughly: "3 weeks". Not for a
 * same-day finish, which is more often catching up on an old game than one
 * sitting.
 */
function playedOver(startedAt: string, finishedAt: string): string | null {
  const days = Math.floor((Date.parse(finishedAt) - Date.parse(startedAt.slice(0, 10))) / DAY_MS);
  if (Number.isNaN(days) || days < 1) return null;
  if (days < 14) return `${days + 1} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.round(days / 365);
  return years === 1 ? 'a year' : `${years} years`;
}

/**
 * This finish's place in the year ("2nd"). Only for a finish dated this year,
 * so a backdated one doesn't claim a place it doesn't have.
 */
function placeInYear(
  finishedAt: string | null | undefined,
  finishedThisYear: number | null | undefined,
): string | null {
  if (!finishedAt || !finishedThisYear) return null;
  if (!finishedAt.startsWith(String(new Date().getFullYear()))) return null;
  return ordinal(finishedThisYear);
}

/** How the time it took compares with the estimate, or nothing without one. */
function againstEstimate(played: number, estimate: number | null): string | null {
  if (!estimate || estimate <= 0 || played <= 0) return null;
  const diff = Math.round((played - estimate) * 10) / 10;
  if (Math.abs(diff) < 0.5) return `Right on the ~${estimate}h estimate`;
  return `${hours(Math.abs(diff))} ${diff > 0 ? 'over' : 'under'} the ~${estimate}h estimate`;
}

const TRACK = 'flex h-2.5 gap-px overflow-hidden rounded-full bg-ink-800';
/** Bars grow from the left once, a moment after the dialog has settled. */
const GROW = 'origin-left animate-grow-x motion-reduce:animate-none';
const GROW_DELAY: CSSProperties = { animationDelay: '200ms' };
/** The game just finished lands on the shelf after the time bar has grown. */
const LAND = 'origin-bottom animate-grow-y motion-reduce:animate-none';
const LAND_DELAY: CSSProperties = { animationDelay: '650ms' };
/** A library up to this size is drawn game by game; a bigger one as a bar. */
const SHELF_MAX = 500;

const percent = (part: number, whole: number) => `${Math.min((part / whole) * 100, 100)}%`;

/**
 * The hours played against the estimate, as one bar. Under the estimate, the
 * track is the estimate and the fill stops short of its end; over it, the
 * track is the hours played and the part past the estimate is lighter.
 */
function TimeBar({ played, estimate }: { played: number; estimate: number }) {
  const over = played > estimate;
  return (
    <div className={TRACK} aria-hidden="true">
      <div className={`flex h-full w-full gap-px ${GROW}`} style={GROW_DELAY}>
        <div
          className={STATUS_STYLE.finished.fill}
          style={{ width: over ? percent(estimate, played) : percent(played, estimate) }}
        />
        {over && <div className="flex-1 bg-emerald-300" />}
      </div>
    </div>
  );
}

/**
 * The library as a shelf: a spine for every game, the finished ones in
 * emerald and the one just finished lighter, landing last. A library too big
 * to draw game by game is one bar instead, this game the lighter sliver at
 * its end (never too thin to see).
 */
function LibraryShelf({ finished, total }: { finished: number; total: number }) {
  if (total > SHELF_MAX) {
    return (
      <div className={TRACK} aria-hidden="true">
        <div className={`flex h-full w-full gap-px ${GROW}`} style={GROW_DELAY}>
          {finished > 1 && (
            <div
              className={STATUS_STYLE.finished.fill}
              style={{ width: percent(finished - 1, total) }}
            />
          )}
          <div className="min-w-1 bg-emerald-300" style={{ width: percent(1, total) }} />
        </div>
      </div>
    );
  }
  const spine = total > 320 ? 'w-[3px]' : 'w-1';
  return (
    <div
      className={`flex flex-wrap gap-y-1.5 ${total > 320 ? 'gap-x-px' : 'gap-x-0.5'}`}
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, i) =>
        i === finished - 1 ? (
          <span
            key={i}
            className={`h-3.5 rounded-[1px] bg-emerald-300 ${spine} ${LAND}`}
            style={LAND_DELAY}
          />
        ) : (
          <span
            key={i}
            className={`h-3.5 rounded-[1px] ${spine} ${i < finished ? STATUS_STYLE.finished.fill : 'bg-ink-700'}`}
          />
        ),
      )}
    </div>
  );
}

/**
 * A finished game, drawn: one sentence for the time it took, a bar of that
 * time against the estimate, the library as a shelf with this game added, and
 * what's next. Each part is left out when its figure is missing. The summary
 * dialog speaks to you; the shared page (`shared`) reads the same for anyone.
 */
export function CompletionSummary({
  playtimeMinutes,
  mainStoryHours,
  rating,
  gamesFinished,
  totalGames,
  nextGame,
  nextGameImage,
  startedAt,
  finishedAt,
  finishedThisYear,
  shared = false,
}: Completion & {
  /** For the dialog's extra facts; the shared page doesn't store these. */
  nextGameImage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  finishedThisYear?: number | null;
  shared?: boolean;
}) {
  const played = Math.round((playtimeMinutes / 60) * 10) / 10;
  const span = startedAt && finishedAt ? playedOver(startedAt, finishedAt) : null;
  const estimate = againstEstimate(played, mainStoryHours);
  const place = placeInYear(finishedAt, finishedThisYear);
  const inLibrary = totalGames > 0 && gamesFinished > 0;

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={`flex items-center gap-1.5 font-medium ${STATUS_STYLE.finished.text}`}>
          <Check className="w-4 h-4" aria-hidden="true" />
          Finished
        </span>
        {rating !== null && <Rating rating={rating} size="md" />}
      </p>

      {played > 0 && (
        <div data-testid="time-played">
          <Lead size="md">
            {shared ? 'Finished in' : 'You finished it in'} <Figure>{whole(hours(played))}</Figure>
            {span && (
              <>
                {' '}
                over <Figure>{whole(span)}</Figure>
              </>
            )}
            .
          </Lead>
          {estimate && mainStoryHours && (
            <div className="mt-4">
              <TimeBar played={played} estimate={mainStoryHours} />
              <p className="mt-2 text-sm text-ink-400">{estimate}</p>
            </div>
          )}
        </div>
      )}

      {inLibrary && (
        <div data-testid="library-progress">
          <LibraryShelf finished={gamesFinished} total={totalGames} />
          <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-ink-400">
            <span>
              <span className="font-medium text-ink-100">{gamesFinished}</span> of {totalGames}{' '}
              games finished
            </span>
            {place && (
              <span>
                Your <span className="font-medium text-ink-100">{place}</span> this year
              </span>
            )}
          </p>
        </div>
      )}

      {nextGame &&
        (nextGameImage ? (
          <div className="flex items-center gap-3">
            <CoverThumb src={nextGameImage} alt="" className="w-24" />
            <p className="min-w-0 text-sm text-ink-400">
              Next up
              <span className="block truncate font-medium text-ink-100">{nextGame}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-400">
            Next up: <span className="font-medium text-ink-100">{nextGame}</span>
          </p>
        ))}
    </div>
  );
}
