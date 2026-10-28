import { Check } from 'lucide-react';
import { Figure, Lead } from '@/components/ui/Lead';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { Rating } from './Rating';

export interface Completion {
  playtimeMinutes: number;
  mainStoryHours: number | null;
  rating: number | null;
  gamesFinished: number;
  totalGames: number;
  backlogHoursRemoved: number | null;
  nextGame: string | null;
}

const hours = (h: number) => `${h} hour${h === 1 ? '' : 's'}`;

const DAY_MS = 24 * 60 * 60 * 1000;

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/**
 * From starting it in the app to finishing it, roughly: "over 3 weeks". Not
 * for a same-day finish, which is more often catching up on an old game than
 * one sitting.
 */
function playedOver(startedAt: string, finishedAt: string): string | null {
  const days = Math.floor((Date.parse(finishedAt) - Date.parse(startedAt.slice(0, 10))) / DAY_MS);
  if (Number.isNaN(days) || days < 1) return null;
  if (days < 14) return `over ${days + 1} days`;
  if (days < 60) return `over ${Math.round(days / 7)} weeks`;
  if (days < 365) return `over ${Math.round(days / 30)} months`;
  const years = Math.round(days / 365);
  return years === 1 ? 'over a year' : `over ${years} years`;
}

/**
 * What this finish adds: its place in the year ("your 5th game finished this
 * year") and how long it took from starting it. Only for a finish dated this
 * year, so a backdated one doesn't claim a place it doesn't have.
 */
function finishFacts(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
  finishedThisYear: number | null | undefined,
): string | null {
  if (!finishedAt) return null;
  const thisYear = finishedAt.startsWith(String(new Date().getFullYear()));
  const place = thisYear && finishedThisYear ? finishedThisYear : null;
  const span = startedAt ? playedOver(startedAt, finishedAt) : null;
  if (place && span) return `It's your ${ordinal(place)} game finished this year, played ${span}.`;
  if (place) return `It's your ${ordinal(place)} game finished this year.`;
  if (span) return `You played it ${span}.`;
  return null;
}

/** How the time it took compares with the estimate, or nothing without one. */
function againstEstimate(played: number, estimate: number | null): string | null {
  if (!estimate || estimate <= 0 || played <= 0) return null;
  const diff = Math.round((played - estimate) * 10) / 10;
  if (Math.abs(diff) < 0.5) return `right on the ~${estimate}h estimate`;
  return `${hours(Math.abs(diff))} ${diff > 0 ? 'over' : 'under'} the ~${estimate}h estimate`;
}

/**
 * A finished game, told in sentences: the time it took against the estimate,
 * then what finishing it did to the library. The summary dialog speaks to you;
 * the shared page (`shared`) reads the same for anyone.
 */
export function CompletionSummary({
  playtimeMinutes,
  mainStoryHours,
  rating,
  gamesFinished,
  totalGames,
  backlogHoursRemoved,
  nextGame,
  startedAt,
  finishedAt,
  finishedThisYear,
  shared = false,
}: Completion & {
  /** For the dialog's extra facts; the shared page doesn't store these. */
  startedAt?: string | null;
  finishedAt?: string | null;
  finishedThisYear?: number | null;
  shared?: boolean;
}) {
  const played = Math.round((playtimeMinutes / 60) * 10) / 10;
  const facts = finishFacts(startedAt, finishedAt, finishedThisYear);
  const estimate = againstEstimate(played, mainStoryHours);
  const your = shared ? 'their' : 'your';
  const impact = [
    totalGames > 0 ? `${gamesFinished} of ${your} ${totalGames} games finished` : null,
    backlogHoursRemoved ? `${hours(backlogHoursRemoved)} off ${your} backlog` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={`flex items-center gap-1.5 font-medium ${STATUS_STYLE.finished.text}`}>
          <Check className="w-4 h-4" aria-hidden="true" />
          Finished
        </span>
        {rating !== null && <Rating rating={rating} size="md" />}
      </p>
      {played > 0 && (
        <div data-testid="estimate-text">
          <Lead size="md">
            {shared ? 'Finished in' : 'You finished it in'} <Figure>{hours(played)}</Figure>
            {estimate && `, ${estimate}`}.
          </Lead>
        </div>
      )}
      {(facts || impact.length > 0) && (
        <p className="text-ink-400">
          {facts}
          {facts && impact.length > 0 && ' '}
          {impact.length > 0 && `That's ${impact.join(', and ')}.`}
        </p>
      )}
      {nextGame && (
        <p className="text-sm text-ink-400">
          Next up: <span className="font-medium text-ink-100">{nextGame}</span>
        </p>
      )}
    </div>
  );
}
