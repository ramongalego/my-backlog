import { playedFor, type ActivityLine } from '@/lib/account/activity';
import { ACTIVITY_LINE } from './activity-line';

/**
 * One thing done to a game, in one sentence: what, how long a finish took,
 * the rating it came with, and last, in brackets, where it was played, the
 * least of it ("Finished in 42h and rated it 9/10 (PC)"). Each is only there
 * when there is one to say, and the sentence reads without it ("Finished",
 * "Finished (PC)", "Finished and rated it 9/10"). A start that came from a
 * pick says which before the platform ("Started playing, picked at random
 * (PS5)"). When it happened is the row's to say, at its far end. Only what
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
    line.kind === 'finished' && line.minutes && `in ${playedFor(line.minutes)}`,
    // A rating given by itself is the whole line ("Rated 9/10"): not said twice.
    line.rating != null &&
      line.kind !== 'rated' &&
      line.kind !== 'rerated' &&
      `and rated it ${line.rating}/10`,
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
      {platform && ` (${platform})`}
    </span>
  );
}
