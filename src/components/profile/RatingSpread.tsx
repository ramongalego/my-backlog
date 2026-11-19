import { Panel } from '@/components/ui/Panel';
import { SidePanelHeading } from './SidePanelHeading';

/** The tallest bar, in pixels. */
const BAR_HEIGHT = 56;

/** What the bars say, for someone who can't see them: only the ratings given. */
function spreadLabel(counts: number[], total: number): string {
  const given = counts.flatMap((count, rating) => (count > 0 ? [`${count} at ${rating}/10`] : []));
  return `${total} rated ${total === 1 ? 'game' : 'games'}: ${given.join(', ')}`;
}

/**
 * How the player rates: a bar for each rating from 0 to 10, as tall as the
 * games given it. Only the shape: no numbers on the bars (Stats has those),
 * just how many games it is drawn from and the two ends of the scale.
 */
export function RatingSpread({
  counts,
}: {
  /** Games at each rating, 0 to 10; null until enough are rated for a shape to show. */
  counts: number[] | null;
}) {
  if (!counts) return null;
  const total = counts.reduce((sum, count) => sum + count, 0);
  const most = Math.max(...counts, 1);

  return (
    <Panel>
      <SidePanelHeading count={total}>Ratings</SidePanelHeading>
      <div
        role="img"
        aria-label={spreadLabel(counts, total)}
        className="flex items-end gap-1"
        style={{ height: BAR_HEIGHT }}
      >
        {counts.map((count, rating) => (
          <div
            key={rating}
            title={
              count > 0 ? `${rating}/10: ${count} ${count === 1 ? 'game' : 'games'}` : undefined
            }
            // The amber of Stats' rating bars and of the rating star. A rating
            // nobody was given keeps its place as a mark on the line.
            className={`flex-1 rounded-sm transition-colors ${count > 0 ? 'bg-amber-400/80 hover:bg-amber-400' : 'bg-ink-800'}`}
            style={{ height: count > 0 ? Math.max((count / most) * BAR_HEIGHT, 4) : 2 }}
          />
        ))}
      </div>
      <div
        className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-500"
        aria-hidden="true"
      >
        <span>0</span>
        <span>10</span>
      </div>
    </Panel>
  );
}
