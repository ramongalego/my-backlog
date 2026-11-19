import type { ActivityLine } from '@/lib/account/activity';
import { ACTIVITY_LINE } from './activity-line';

/**
 * One thing done to a game, in one sentence: what, where it was played, and
 * the rating it came with ("Finished on PC and rated it 9/10"). Each of those
 * is only there when there is one to say, and the sentence reads without it
 * ("Finished", "Finished on PC", "Finished and rated it 9/10"). When it
 * happened is the row's to say, at its far end. A start that came from a pick
 * ends by saying which ("Started playing on PS5, picked at random"). Only what
 * was done has the icon and the color; the rest reads on from it.
 */
export function ActivityWhat({
  line,
  platform,
}: {
  line: ActivityLine;
  /** Left out where a line doesn't name one. */
  platform?: string | null;
}) {
  const { icon: Icon, text, what } = ACTIVITY_LINE[line.kind];
  const rest = [
    platform && `on ${platform}`,
    // A rating given by itself is the whole line ("Rated 9/10"): not said twice.
    line.rating != null && line.kind !== 'rated' && `and rated it ${line.rating}/10`,
  ].filter(Boolean);
  const picked =
    line.pickedBy === 'random'
      ? ', picked at random'
      : line.pickedBy === 'questions'
        ? ', picked by Pick My Game'
        : '';
  return (
    <span>
      <span className={text}>
        {/* In the line of text, not beside it: the words that follow sit on
            the same baseline as these. */}
        <Icon className="mr-1 inline-block h-3.5 w-3.5 align-[-0.125em]" aria-hidden="true" />
        {what(line)}
      </span>
      {rest.length > 0 && ` ${rest.join(' ')}`}
      {picked}
    </span>
  );
}
