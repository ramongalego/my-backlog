import type { ProfileFigures } from '@/lib/account/figures';
import { FIGURE_CELL, FIGURE_STRIP } from './profile-layout';

interface Figure {
  label: string;
  /** The label on the narrowest phones, where each figure has about 50px. */
  short?: string;
  value: string;
}

const count = (value: number) => value.toLocaleString('en-US');

/**
 * The average rating is the last figure, and only there once enough games are
 * rated for it to say something (`avgRating` is null until then).
 */
function figuresOf(figures: ProfileFigures): Figure[] {
  return [
    { label: 'Backlog', value: count(figures.backlog) },
    { label: 'Finished', value: count(figures.finished) },
    { label: 'This year', value: count(figures.finishedThisYear) },
    { label: 'Hours played', short: 'Hours', value: count(figures.hours) },
    ...(figures.avgRating == null
      ? []
      : // Always to one decimal, so "8.0" doesn't read as a count of eight.
        [{ label: 'Avg rating', short: 'Rating', value: figures.avgRating.toFixed(1) }]),
  ];
}

/** The figures are one strip parted by hairlines, not a row of tiles. */
export function ProfileFigureStrip({ figures }: { figures: ProfileFigures }) {
  const shown = figuresOf(figures);
  return (
    <dl className={`${FIGURE_STRIP[shown.length === 5 ? 5 : 4]} divide-x divide-ink-800`}>
      {shown.map(({ label, short, value }) => (
        // The figure reads first, its label under it.
        <div key={label} className={`flex min-w-0 flex-col-reverse ${FIGURE_CELL}`}>
          <dt className="mt-0.5 truncate text-xs text-ink-500">
            {short ? (
              <>
                <span className="min-[400px]:hidden">{short}</span>
                <span className="max-[399px]:hidden">{label}</span>
              </>
            ) : (
              label
            )}
          </dt>
          <dd className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-50">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
