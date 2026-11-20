import type { ReactNode } from 'react';
import { CalendarDays, Clock, Dices, Sparkles, type LucideIcon } from 'lucide-react';
import { Rating } from '@/components/games/Rating';
import { playedFor, type ActivityLine } from '@/lib/account/activity';
import { spanOfDays } from '@/lib/games/played-over';

function Stat({
  icon: Icon,
  said,
  children,
}: {
  icon: LucideIcon;
  said: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden="true" />
      <span className="sr-only">{said} </span>
      {children}
    </span>
  );
}

const PICKED: Record<NonNullable<ActivityLine['pickedBy']>, { icon: LucideIcon; text: string }> = {
  random: { icon: Dices, text: 'Picked at random' },
  questions: { icon: Sparkles, text: 'Picked by Pick My Game' },
};

/**
 * Under a finish, what there is to say about it: the rating, the hours it
 * took, how many days it was played over, and whether a pick started it. Each
 * only when known; nothing at all when none is.
 */
export function FinishStats({ line }: { line: ActivityLine }) {
  const span = line.days != null ? spanOfDays(line.days) : null;
  const picked = line.pickedBy && PICKED[line.pickedBy];
  const stats = [
    line.rating != null && (
      <span key="rating" className="inline-flex">
        <span className="sr-only">Rated </span>
        <Rating rating={line.rating} />
      </span>
    ),
    !!line.minutes && (
      <Stat key="hours" icon={Clock} said="Played for">
        {playedFor(line.minutes)}
      </Stat>
    ),
    span && (
      <Stat key="days" icon={CalendarDays} said="over">
        {span}
      </Stat>
    ),
    picked && (
      <span
        key="picked"
        className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-1.5 py-0.5 text-xs whitespace-nowrap text-ink-300"
      >
        <picked.icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {picked.text}
      </span>
    ),
  ].filter(Boolean);
  if (stats.length === 0) return null;
  return (
    <span
      data-line
      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-300"
    >
      {/* Spaces between them, for a screen reader: the gap is only drawn. */}
      {stats.flatMap((stat, index) => (index ? [' ', stat] : [stat]))}
    </span>
  );
}
