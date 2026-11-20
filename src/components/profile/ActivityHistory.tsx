import { Panel } from '@/components/ui/Panel';
import { ACTIVITY_WEEKS, activityFrom } from '@/lib/account/activity';
import { toLocalIsoDate } from '@/lib/diary/date-utils';
import { HOVER_TIP_TARGET, HoverTip } from './HoverTip';
import { SidePanelHeading } from './SidePanelHeading';

/** "YYYY-MM-DD" as a day in the time zone it is drawn in. */
const dayOf = (day: string) =>
  new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));

/** "Wed, Nov 18, 2026". */
const dayLabel = (day: string) =>
  dayOf(day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** A day's tip, by its week: lined up with its left edge in the first weeks and its right in the last. */
const tipAlign = (week: number) =>
  week < 6 ? 'start' : week >= ACTIVITY_WEEKS - 6 ? 'end' : 'center';

/** How lit a day is, by how much was done: the accent, stronger with more. */
function shade(count: number): string {
  if (count >= 7) return 'bg-accent-400';
  if (count >= 4) return 'bg-accent-500/85';
  if (count >= 2) return 'bg-accent-500/60';
  return 'bg-accent-500/35';
}

/**
 * The last six months, a square a day, a column a week (Sunday at the top),
 * lit by how much the player did. Only that: no months, no legend, no streak.
 * A lit day says its date and how much on hover; an empty one says nothing.
 * Left out when nothing at all was done in it.
 */
export function ActivityHistory({
  days,
  today,
}: {
  /** Things done each day, by "YYYY-MM-DD" (activityByDay). */
  days: Record<string, number>;
  /** "YYYY-MM-DD": the last square. */
  today: string;
}) {
  const squares: { day: string; count: number }[] = [];
  for (let date = dayOf(activityFrom(dayOf(today))); ; date.setDate(date.getDate() + 1)) {
    const day = toLocalIsoDate(date);
    squares.push({ day, count: days[day] ?? 0 });
    if (day >= today) break;
  }
  const active = squares.filter((square) => square.count > 0).length;
  if (active === 0) return null;

  return (
    <Panel>
      <SidePanelHeading>Activity</SidePanelHeading>
      <div
        role="img"
        aria-label={`Active on ${active} ${active === 1 ? 'day' : 'days'} in the last ${ACTIVITY_WEEKS} weeks`}
        className="grid grid-flow-col grid-rows-7 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${ACTIVITY_WEEKS}, minmax(0, 1fr))` }}
      >
        {squares.map(({ day, count }, index) =>
          count > 0 ? (
            <div
              key={day}
              data-day={day}
              className={`${HOVER_TIP_TARGET} aspect-square rounded-[2px] ${shade(count)}`}
            >
              <HoverTip
                title={dayLabel(day)}
                detail={`${count} ${count === 1 ? 'update' : 'updates'}`}
                align={tipAlign(Math.floor(index / 7))}
              />
            </div>
          ) : (
            // An empty day sinks into the panel, darker than it, so the grid
            // is quiet and only what was done stands out. It says nothing.
            <div key={day} className="aspect-square rounded-[2px] bg-ink-950" />
          ),
        )}
      </div>
    </Panel>
  );
}
